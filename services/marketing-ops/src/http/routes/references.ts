import type { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../../auth/permissions.js';
import type { RagCourseClient } from '../../integrations/ragCourseClient.js';
import { actorFrom, asyncRoute, requireFeature } from '../middleware.js';

const querySchema = z.string().trim().min(2).max(200);
const limitSchema = z.coerce.number().int().min(1).max(25).default(10);

export function registerReferences(
  router: Router,
  courses: RagCourseClient,
  features: { read: boolean; write: boolean }
): void {
  router.get('/v1/references/courses', asyncRoute(async (request, response) => {
    requireFeature(features.read, 'read');
    authorize(actorFrom(request), 'reference.read');
    const data = await courses.searchCourses(
      querySchema.parse(request.query.q),
      limitSchema.parse(request.query.limit)
    );
    response.json({ data });
  }));
}
