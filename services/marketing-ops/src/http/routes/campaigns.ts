import type { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { archiveCampaign, createCampaignDraft, updateCampaignDraft } from '../../domain/campaigns.js';
import { getCampaign, listCampaigns } from '../../domain/queries.js';
import { actorFrom, asyncRoute, parseIfMatch, requireFeature, requireIdempotencyKey } from '../middleware.js';

const courseSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/);
const createBodySchema = z.object({ name: z.string().trim().min(1).max(200), courseSlug: courseSlug.optional() }).strict();
const updateBodySchema = z.object({ name: z.string().trim().min(1).max(200) }).strict();
const uuid = z.string().uuid();

export function registerCampaigns(router: Router, pool: Pool, features: { read: boolean; write: boolean }) {
  router.get('/v1/campaigns', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(request.query.limit);
    const status = z.enum(['draft', 'archived']).optional().parse(request.query.status);
    const course = courseSlug.optional().parse(request.query.course);
    const owner = uuid.optional().parse(request.query.owner);
    const from = z.string().datetime({ offset: true }).optional().parse(request.query.from);
    const to = z.string().datetime({ offset: true }).optional().parse(request.query.to);
    const cursor = z.string().min(1).max(1024).optional().parse(request.query.cursor);
    const filters = {
      limit,
      ...(status ? { status } : {}), ...(course ? { courseSlug: course } : {}),
      ...(owner ? { ownerId: owner } : {}), ...(from ? { updatedFrom: from } : {}),
      ...(to ? { updatedTo: to } : {}), ...(cursor ? { cursor } : {})
    };
    const result = await listCampaigns({ pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' }, filters);
    response.json({ data: result.data, page: { limit, count: result.data.length, nextCursor: result.nextCursor } });
  }));
  router.get('/v1/campaigns/:id', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const data = await getCampaign({ pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' }, uuid.parse(request.params.id));
    response.setHeader('ETag', `"${data.version}"`).json({ data });
  }));
  router.post('/v1/campaigns', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const input = createBodySchema.parse(request.body);
    const data = await createCampaignDraft(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      { name: input.name, idempotencyKey: requireIdempotencyKey(request), ...(input.courseSlug ? { courseSlug: input.courseSlug } : {}) }
    );
    response.status(201).setHeader('ETag', `"${data.version}"`).json({ data });
  }));
  router.patch('/v1/campaigns/:id', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const data = await updateCampaignDraft(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id), parseIfMatch(request),
      { ...updateBodySchema.parse(request.body), idempotencyKey: requireIdempotencyKey(request) }
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
