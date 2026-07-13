import { z } from 'zod/v4';

const planRef = z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/);
const courseSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/);
const uuid = z.string().uuid();
const positiveInteger = z.union([
  z.number().int().positive(),
  z.string().regex(/^[1-9]\d*$/)
]).transform((value) => typeof value === 'string' ? Number(value) : value);

const createCampaignAction = z.object({
  type: z.literal('campaign.create_draft'),
  ref: planRef,
  name: z.string().trim().min(1).max(200),
  course_slug: courseSlug.optional()
}).strict();

const updateCampaignAction = z.object({
  type: z.literal('campaign.update_draft'),
  campaign_id: uuid,
  expected_version: positiveInteger,
  name: z.string().trim().min(1).max(200)
}).strict();

const createItemAction = z.object({
  type: z.literal('campaign_item.create_draft'),
  campaign_id: uuid.optional(),
  campaign_ref: planRef.optional(),
  kind: z.string().trim().min(1).max(80),
  title: z.string().trim().max(200).optional(),
  content: z.unknown()
}).strict().refine(
  (value) => Boolean(value.campaign_id) !== Boolean(value.campaign_ref),
  { message: 'Exactly one campaign_id or campaign_ref is required' }
);

export const marketingOpsPlanActionSchema = z.discriminatedUnion('type', [
  createCampaignAction,
  updateCampaignAction,
  createItemAction
]);

export const marketingOpsPlanActionsSchema = z.array(marketingOpsPlanActionSchema)
  .min(1)
  .max(20)
  .superRefine((actions, context) => {
    const refs = new Set<string>();
    for (const [index, action] of actions.entries()) {
      if (action.type === 'campaign.create_draft') {
        if (refs.has(action.ref)) {
          context.addIssue({ code: 'custom', message: `Duplicate campaign ref ${action.ref}`, path: [index, 'ref'] });
        }
        refs.add(action.ref);
      }
      if (action.type === 'campaign_item.create_draft' && action.campaign_ref && !refs.has(action.campaign_ref)) {
        context.addIssue({ code: 'custom', message: `Unknown earlier campaign ref ${action.campaign_ref}`, path: [index, 'campaign_ref'] });
      }
    }
  });

export type MarketingOpsPlanAction = z.infer<typeof marketingOpsPlanActionSchema>;

export function requiredScopesForPlan(actions: MarketingOpsPlanAction[]): string[] {
  const scopes = new Set<string>();
  for (const action of actions) {
    if (action.type === 'campaign_item.create_draft') scopes.add('item:write');
    else scopes.add('campaign:write');
  }
  return [...scopes];
}
