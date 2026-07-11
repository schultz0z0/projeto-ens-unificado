import type { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { archiveCampaign, createCampaignDraft, updateCampaignDraft } from '../../domain/campaigns.js';
import { getCampaign, listCampaigns } from '../../domain/queries.js';
import { actorFrom, asyncRoute, parseIfMatch, requireFeature, requireIdempotencyKey } from '../middleware.js';

const bodySchema = z.object({ name: z.string().trim().min(1).max(200) }).strict();
const uuid = z.string().uuid();

export function registerCampaigns(router: Router, pool: Pool, features: { read: boolean; write: boolean }) {
  router.get('/v1/campaigns', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(request.query.limit);
    const status = z.enum(['draft', 'archived']).optional().parse(request.query.status);
    const filters = status === undefined ? { limit } : { limit, status };
    const data = await listCampaigns({ pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' }, filters);
    response.json({ data, page: { limit, count: data.length } });
  }));
  router.get('/v1/campaigns/:id', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const data = await getCampaign({ pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' }, uuid.parse(request.params.id));
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));
  router.post('/v1/campaigns', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const input = bodySchema.parse(request.body);
    const data = await createCampaignDraft({ pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' }, { ...input, idempotencyKey: requireIdempotencyKey(request) });
    response.status(201).setHeader('ETag', `"${data.version}"`).json({ data });
  }));
  router.patch('/v1/campaigns/:id', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const data = await updateCampaignDraft(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id), parseIfMatch(request),
      { ...bodySchema.parse(request.body), idempotencyKey: requireIdempotencyKey(request) }
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));
  router.post('/v1/campaigns/:id/archive', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const data = await archiveCampaign(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id), parseIfMatch(request), requireIdempotencyKey(request)
    );
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));
}
