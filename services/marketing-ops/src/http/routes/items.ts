import type { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createCampaignItemDraft, updateCampaignItemDraft } from '../../domain/items.js';
import { actorFrom, asyncRoute, parseIfMatch, requireFeature, requireIdempotencyKey } from '../middleware.js';

const uuid = z.string().uuid();
const createSchema = z.object({ kind: z.string().trim().min(1).max(80), title: z.string().trim().max(200).optional(), content: z.unknown() }).strict();
const updateSchema = z.object({ title: z.string().trim().max(200).optional(), content: z.unknown() }).strict();

export function registerItems(router: Router, pool: Pool, features: { read: boolean; write: boolean }) {
  router.post('/v1/campaigns/:campaignId/items', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const parsed = createSchema.parse(request.body);
    const input = {
      kind: parsed.kind,
      content: parsed.content,
      idempotencyKey: requireIdempotencyKey(request),
      ...(parsed.title === undefined ? {} : { title: parsed.title })
    };
    const data = await createCampaignItemDraft(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' }, uuid.parse(request.params.campaignId),
      input
    );
    response.status(201).setHeader('ETag', `"${data.version}"`).json({ data });
  }));
  router.patch('/v1/campaigns/:campaignId/items/:itemId', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const parsed = updateSchema.parse(request.body);
    const input = {
      content: parsed.content,
      idempotencyKey: requireIdempotencyKey(request),
      ...(parsed.title === undefined ? {} : { title: parsed.title })
    };
    const data = await updateCampaignItemDraft(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.campaignId), uuid.parse(request.params.itemId), parseIfMatch(request),
      input
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));
}
