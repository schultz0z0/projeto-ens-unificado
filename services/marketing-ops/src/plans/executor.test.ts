import { describe, expect, it, vi } from 'vitest';
import { appError } from '../errors.js';
import type { CommandContext } from '../domain/context.js';
import type { MarketingOpsPlan } from './token.js';
import { executeMarketingOpsPlan } from './executor.js';

const context: CommandContext = {
  pool: {} as CommandContext['pool'],
  actor: {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantSlug: 'ens',
    role: 'member'
  },
  correlationId: '33333333-3333-4333-8333-333333333333',
  origin: 'mcp' as const
};

function plan(actions: MarketingOpsPlan['actions']): MarketingOpsPlan {
  return {
    plan_id: '44444444-4444-4444-8444-444444444444',
    plan_hash: 'a'.repeat(64),
    sub: context.actor.userId,
    tenant_id: context.actor.tenantId,
    chat_session_id: '22222222-2222-4222-8222-222222222222',
    prepared_jti: 'preparation-jti',
    actions,
    contract_version: 1,
    iat: 1_700_000_000,
    nbf: 1_699_999_999,
    exp: 1_700_000_900
  };
}

describe('Marketing Ops plan executor', () => {
  it('executes one confirmed multi-action plan and resolves campaign references', async () => {
    const createCampaign = vi.fn().mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555', name: 'Volta as aulas' });
    const createItem = vi.fn().mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666', campaignId: '55555555-5555-4555-8555-555555555555' });
    const result = await executeMarketingOpsPlan(context, plan([
      { type: 'campaign.create_draft', ref: 'campaign-main', name: 'Volta as aulas' },
      {
        type: 'campaign_item.create', campaign_ref: 'campaign-main', kind: 'email',
        title: 'Boas-vindas'
      }
    ]), {
      createCampaignDraft: createCampaign,
      updateCampaignDraft: vi.fn(),
      createCampaignItemDraft: createItem
    });

    expect(result).toMatchObject({ status: 'completed', planId: '44444444-4444-4444-8444-444444444444' });
    expect(result.completed).toHaveLength(2);
    expect(createCampaign).toHaveBeenCalledWith(context, {
      name: 'Volta as aulas',
      idempotencyKey: 'plan:44444444-4444-4444-8444-444444444444:0'
    });
    expect(createItem).toHaveBeenCalledWith(context, '55555555-5555-4555-8555-555555555555', {
      kind: 'email', title: 'Boas-vindas', content: {},
      idempotencyKey: 'plan:44444444-4444-4444-8444-444444444444:1'
    });
  });

  it('reports completed, failed and pending actions without claiming full success', async () => {
    const result = await executeMarketingOpsPlan(context, plan([
      { type: 'campaign.create_draft', ref: 'campaign-main', name: 'Campanha parcial' },
      {
        type: 'campaign_item.create', campaign_ref: 'campaign-main', kind: 'email',
        title: 'Falha'
      },
      {
        type: 'campaign.update', campaign_id: '77777777-7777-4777-8777-777777777777',
        expected_version: 1, patch: { name: 'Nao executada' }
      }
    ]), {
      createCampaignDraft: vi.fn().mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555' }),
      updateCampaignDraft: vi.fn(),
      createCampaignItemDraft: vi.fn().mockRejectedValue(appError('dependency_unavailable', 503, 'Database unavailable'))
    });

    expect(result.status).toBe('partial');
    expect(result.completed).toHaveLength(1);
    expect(result.failed).toMatchObject({ index: 1, error: { code: 'dependency_unavailable', status: 503 } });
    expect(result.pending).toEqual([2]);
  });
});
