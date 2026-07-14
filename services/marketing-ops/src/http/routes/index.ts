import { Router } from 'express';
import type { Pool } from 'pg';
import type { SupabaseUser } from '../../auth/supabaseAuth.js';
import { authMiddleware, corsMiddleware } from '../middleware.js';
import { registerAudit } from './audit.js';
import { registerCampaigns } from './campaigns.js';
import { registerCapabilities } from './capabilities.js';
import { registerItems } from './items.js';
import { registerMaterials } from './materials.js';
import { registerParticipants } from './participants.js';
import { registerReferences } from './references.js';
import type { ArtifactClient } from '../../integrations/artifactClient.js';
import type { RagCourseClient } from '../../integrations/ragCourseClient.js';
import type { DelegationKeyring } from '../../delegation/claims.js';
import { createMcpRouter } from '../../mcp/http.js';

export interface ApiRouterDependencies {
  pool: Pool;
  corsOrigins: string[];
  features: { read: boolean; write: boolean };
  verifyToken: (token: string) => Promise<SupabaseUser>;
  artifactClient: ArtifactClient;
  ragCourseClient: RagCourseClient;
  keyring?: DelegationKeyring;
  refreshDelegation?: (token: string) => Promise<string>;
}

export function createApiRouter(deps: ApiRouterDependencies): Router {
  const router = Router();
  router.use(corsMiddleware(deps.corsOrigins));
  registerCapabilities(router, deps.features);
  router.use('/v1', authMiddleware(deps.pool, deps.verifyToken));
  registerCampaigns(router, deps.pool, deps.ragCourseClient, deps.features);
  registerParticipants(router, deps.pool, deps.features);
  registerMaterials(router, deps.pool, deps.artifactClient, deps.features);
  registerReferences(router, deps.ragCourseClient, deps.features);
  registerItems(router, deps.pool, deps.features);
  registerAudit(router, deps.pool, deps.features);
  if (deps.keyring) router.use(createMcpRouter({
    pool: deps.pool,
    features: deps.features,
    keyring: deps.keyring,
    ...(deps.refreshDelegation ? { refreshDelegation: deps.refreshDelegation } : {})
  }));
  return router;
}
