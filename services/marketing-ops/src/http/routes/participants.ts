import type { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  AddParticipantSchema,
  UpdateParticipantSchema,
  addParticipant,
  listParticipantCandidates,
  listParticipants,
  removeParticipant,
  updateParticipant
} from '../../domain/participants.js';
import {
  actorFrom,
  asyncRoute,
  parseIfMatch,
  requireFeature,
  requireIdempotencyKey
} from '../middleware.js';

const uuid = z.string().uuid();

export function registerParticipants(
  router: Router,
  pool: Pool,
  features: { read: boolean; write: boolean }
): void {
  router.get('/v1/campaigns/:id/participants', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const data = await listParticipants(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id)
    );
    response.json({ data });
  }));

  router.get('/v1/campaigns/:id/participant-candidates', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    const q = z.string().trim().max(100).catch('').parse(request.query.q);
    const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(request.query.limit);
    const data = await listParticipantCandidates(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id),
      { q, limit }
    );
    response.json({ data });
  }));

  router.post('/v1/campaigns/:id/participants', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const data = await addParticipant(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id),
      parseIfMatch(request),
      { ...AddParticipantSchema.parse(request.body), idempotencyKey: requireIdempotencyKey(request) }
    );
    response.status(201).setHeader('ETag', `"${data.campaignVersion}"`).json({ data });
  }));

  router.patch('/v1/campaigns/:id/participants/:userId', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const data = await updateParticipant(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id),
      uuid.parse(request.params.userId),
      parseIfMatch(request),
      { ...UpdateParticipantSchema.parse(request.body), idempotencyKey: requireIdempotencyKey(request) }
    );
    response.setHeader('ETag', `"${data.campaignVersion}"`).json({ data });
  }));

  router.delete('/v1/campaigns/:id/participants/:userId', asyncRoute(async (request, response) => {
    requireFeature(features.write, 'write');
    const data = await removeParticipant(
      { pool, actor: actorFrom(request), correlationId: request.correlationId, origin: 'rest' },
      uuid.parse(request.params.id),
      uuid.parse(request.params.userId),
      parseIfMatch(request),
      requireIdempotencyKey(request)
    );
    response.setHeader('ETag', `"${data.campaignVersion}"`).json({ data });
  }));
}
