import { Router } from 'express';
import type { Pool } from 'pg';
import type { SupabaseUser } from '../../auth/supabaseAuth.js';
import { authMiddleware, corsMiddleware } from '../middleware.js';
import { registerAudit } from './audit.js';
import { registerCampaigns } from './campaigns.js';
import { registerCapabilities } from './capabilities.js';
import { registerItems } from './items.js';

export interface ApiRouterDependencies {
  pool: Pool;
  corsOrigins: string[];
  features: { read: boolean; write: boolean };
  verifyToken: (token: string) => Promise<SupabaseUser>;
}

export function createApiRouter(deps: ApiRouterDependencies): Router {
  const router = Router();
  router.use(corsMiddleware(deps.corsOrigins));
  registerCapabilities(router, deps.features);
  router.use('/v1', authMiddleware(deps.pool, deps.verifyToken));
  registerCampaigns(router, deps.pool, deps.features);
  registerItems(router, deps.pool, deps.features);
  registerAudit(router, deps.pool, deps.features);
  return router;
}
