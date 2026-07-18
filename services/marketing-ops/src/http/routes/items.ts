import type { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  ItemChannelSchema,
  ItemKindSchema,
  ItemPrioritySchema,
  ItemStatusSchema,
  ProductionItemPatchSchema
} from '../../domain/contracts.js';
import {
  createCampaignItemDraft,
  createProductionItem,
  getProductionItem,
  transitionProductionItem,
  updateCampaignItemDraft,
  updateProductionItem
} from '../../domain/items.js';
import { listProductionSchedule } from '../../domain/queries.js';
import { DEFAULT_TENANT_TIME_ZONE } from '../../domain/scheduling.js';
import {
  actorFrom,
  asyncRoute,
  parseIfMatch,
  requireFeature,
  requireIdempotencyKey
} from '../middleware.js';

const uuid = z.string().uuid();
const nullableInstant = z.string().datetime({ offset: true }).nullable();
const metadata = z.record(z.unknown());

const productionItemCreateSchema = z.object({
  campaignId: uuid,
  kind: ItemKindSchema,
  title: z.string().trim().min(1).max(200),
  assigneeUserId: uuid.nullable().optional(),
  priority: ItemPrioritySchema.optional(),
  channel: ItemChannelSchema.nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  startsAt: nullableInstant.optional(),
  dueAt: nullableInstant.optional(),
  metadata: metadata.optional()
}).strict();

const productionItemTransitionSchema = z.object({
  to: ItemStatusSchema
}).strict();

const productionItemScheduleQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  campaignId: uuid.optional(),
  kind: ItemKindSchema.optional(),
  channel: ItemChannelSchema.optional(),
  assigneeId: uuid.optional(),
  status: ItemStatusSchema.optional(),
  priority: ItemPrioritySchema.optional(),
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

const itemParamsSchema = z.object({ itemId: uuid }).strict();
const legacyCreateSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  title: z.string().trim().max(200).optional(),
  content: z.unknown()
}).strict();
const legacyUpdateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.unknown()
}).strict();

export const parseProductionItemCreateBody = (value: unknown) =>
  productionItemCreateSchema.parse(value);
export const parseProductionItemPatchBody = (value: unknown) =>
  ProductionItemPatchSchema.parse(value);
export const parseProductionItemTransitionBody = (value: unknown) =>
  productionItemTransitionSchema.parse(value);
export const parseProductionItemScheduleQuery = (value: unknown) =>
  productionItemScheduleQuerySchema.parse(value);

export function registerItems(
  router: Router,
  pool: Pool,
  features: { read: boolean; write: boolean },
  tenantTimeZone = DEFAULT_TENANT_TIME_ZONE
): void {
  router.get('/v1/campaign-items', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const filters = parseProductionItemScheduleQuery(request.query);
    const scheduleFilters = {
      limit: filters.limit,
      ...(filters.from === undefined ? {} : { from: filters.from }),
      ...(filters.to === undefined ? {} : { to: filters.to }),
      ...(filters.campaignId === undefined ? {} : { campaignId: filters.campaignId }),
      ...(filters.kind === undefined ? {} : { kind: filters.kind }),
      ...(filters.channel === undefined ? {} : { channel: filters.channel }),
      ...(filters.assigneeId === undefined ? {} : { assigneeId: filters.assigneeId }),
      ...(filters.status === undefined ? {} : { status: filters.status }),
      ...(filters.priority === undefined ? {} : { priority: filters.priority }),
      ...(filters.cursor === undefined ? {} : { cursor: filters.cursor })
    };
    const result = await listProductionSchedule(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      scheduleFilters,
      tenantTimeZone
    );
    response.json({
      data: result.data,
      page: {
        limit: filters.limit,
        count: result.data.length,
        nextCursor: result.nextCursor
      },
      meta: { timeZone: result.timeZone }
    });
  }));

  router.post('/v1/campaign-items', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const { campaignId, ...input } = parseProductionItemCreateBody(request.body);
    const data = await createProductionItem(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      campaignId,
      { ...input, idempotencyKey: requireIdempotencyKey(request) }
    );
    response.status(201).setHeader('ETag', `"${data.version}"`).json({ data });
  }));

  router.get('/v1/campaign-items/:itemId', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const { itemId } = itemParamsSchema.parse(request.params);
    const data = await getProductionItem(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      itemId
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));

  router.patch('/v1/campaign-items/:itemId', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const { itemId } = itemParamsSchema.parse(request.params);
    const patch = parseProductionItemPatchBody(request.body);
    const data = await updateProductionItem(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      itemId,
      parseIfMatch(request),
      { ...patch, idempotencyKey: requireIdempotencyKey(request) }
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));

  router.post('/v1/campaign-items/:itemId/transition', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const { itemId } = itemParamsSchema.parse(request.params);
    const { to } = parseProductionItemTransitionBody(request.body);
    const data = await transitionProductionItem(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      itemId,
      parseIfMatch(request),
      to,
      requireIdempotencyKey(request)
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));

  // Compatibility endpoints retained until the Phase 3 migration is accepted.
  router.post('/v1/campaigns/:campaignId/items', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const parsed = legacyCreateSchema.parse(request.body);
    const input = {
      kind: parsed.kind,
      content: parsed.content,
      idempotencyKey: requireIdempotencyKey(request),
      ...(parsed.title === undefined ? {} : { title: parsed.title })
    };
    const data = await createCampaignItemDraft(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      uuid.parse(request.params.campaignId),
      input
    );
    response.status(201).setHeader('ETag', `"${data.version}"`).json({ data });
  }));

  router.patch('/v1/campaigns/:campaignId/items/:itemId', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const parsed = legacyUpdateSchema.parse(request.body);
    const input = {
      content: parsed.content,
      idempotencyKey: requireIdempotencyKey(request),
      ...(parsed.title === undefined ? {} : { title: parsed.title })
    };
    const data = await updateCampaignItemDraft(
      {
        pool,
        actor: actorFrom(request),
        correlationId: request.correlationId,
        origin: 'rest'
      },
      uuid.parse(request.params.campaignId),
      uuid.parse(request.params.itemId),
      parseIfMatch(request),
      input
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));
}
