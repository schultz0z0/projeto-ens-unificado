import { AppError } from '../errors.js';
import { createCampaignDraft, updateCampaignDraft } from '../domain/campaigns.js';
import type { CommandContext } from '../domain/context.js';
import { createCampaignItemDraft } from '../domain/items.js';
import type { MarketingOpsPlan } from './token.js';

interface PlanExecutorDependencies {
  createCampaignDraft: typeof createCampaignDraft;
  updateCampaignDraft: typeof updateCampaignDraft;
  createCampaignItemDraft: typeof createCampaignItemDraft;
}

const defaultDependencies: PlanExecutorDependencies = {
  createCampaignDraft,
  updateCampaignDraft,
  createCampaignItemDraft
};

export interface MarketingOpsPlanExecutionResult {
  planId: string;
  status: 'completed' | 'partial' | 'failed';
  completed: Array<{ index: number; type: MarketingOpsPlan['actions'][number]['type']; data: unknown }>;
  failed?: { index: number; type: MarketingOpsPlan['actions'][number]['type']; error: { code: string; message: string; status: number } };
  pending: number[];
}

export async function executeMarketingOpsPlan(
  context: CommandContext,
  plan: MarketingOpsPlan,
  dependencies: PlanExecutorDependencies = defaultDependencies
): Promise<MarketingOpsPlanExecutionResult> {
  const campaignRefs = new Map<string, string>();
  const completed: MarketingOpsPlanExecutionResult['completed'] = [];

  for (const [index, action] of plan.actions.entries()) {
    const idempotencyKey = `plan:${plan.plan_id}:${index}`;
    try {
      let data: unknown;
      if (action.type === 'campaign.create_draft') {
        data = await dependencies.createCampaignDraft(context, {
          name: action.name,
          idempotencyKey,
          ...(action.course_slug ? { courseSlug: action.course_slug } : {})
        });
        campaignRefs.set(action.ref, (data as { id: string }).id);
      } else if (action.type === 'campaign.update_draft') {
        data = await dependencies.updateCampaignDraft(context, action.campaign_id, action.expected_version, {
          name: action.name,
          idempotencyKey
        });
      } else {
        const campaignId = action.campaign_id ?? campaignRefs.get(action.campaign_ref ?? '');
        if (!campaignId) throw new AppError('plan_invalid', 400, 'Campaign reference could not be resolved');
        data = await dependencies.createCampaignItemDraft(context, campaignId, {
          kind: action.kind,
          content: action.content,
          idempotencyKey,
          ...(action.title ? { title: action.title } : {})
        });
      }
      completed.push({ index, type: action.type, data });
    } catch (error) {
      const safe = error instanceof AppError
        ? { code: error.code, message: error.message, status: error.status }
        : { code: 'internal_error', message: 'Internal server error', status: 500 };
      return {
        planId: plan.plan_id,
        status: completed.length > 0 ? 'partial' : 'failed',
        completed,
        failed: { index, type: action.type, error: safe },
        pending: plan.actions.slice(index + 1).map((_, offset) => index + offset + 1)
      };
    }
  }

  return { planId: plan.plan_id, status: 'completed', completed, pending: [] };
}
