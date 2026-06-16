import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { getActiveClient, listActiveContexts, setActiveClient } from '../context/activeContext.js';
import type { AppConfig } from '../config/schema.js';
import { createEmbeddingProviderFromEnv } from '../ingestion/embeddings/embeddingProvider.js';
import { IngestionService } from '../ingestion/ingestionService.js';
import { buildEnsCourseContext } from '../ingestion/sources/ens/ensCourseContext.js';
import { assertTenantAccess, TenantAccessError, type TenantPolicyConfig } from '../policy/tenantPolicy.js';
import type { RagRepository } from '../rag/types.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

export type ServerDependencies = {
  config: AppConfig;
  repository: RagRepository;
};

const actorProfileSchema = z.string().min(1).default('default');

export function createNexusRagMcpServer({ config, repository }: ServerDependencies): McpServer {
  const server = new McpServer({
    name: 'nexusai-rag-mcp',
    version: '0.1.0'
  });

  const policy = toTenantPolicy(config);
  const embeddingProvider = createEmbeddingProviderFromEnv();
  const ingestionService = new IngestionService(repository, embeddingProvider);

  server.registerTool(
    'nexus_rag_set_active_client',
    {
      title: 'Set Active NexusAI RAG Client',
      description: 'Set the active client tenant for a Hermes profile before RAG lookups.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        client_id: z.string().min(1).describe('Tenant slug, for example cliente_acme.')
      }
    },
    async ({ actor_profile, client_id }) => {
      setActiveClient(actor_profile, client_id);

      return jsonToolResult({
        ok: true,
        actor_profile,
        active_client: client_id
      });
    }
  );

  server.registerTool(
    'nexus_rag_context_status',
    {
      title: 'NexusAI RAG Context Status',
      description: 'Show active client context and policy settings for NexusAI RAG.',
      inputSchema: {
        actor_profile: actorProfileSchema
      }
    },
    async ({ actor_profile }) =>
      jsonToolResult({
        actor_profile,
        active_client: getActiveClient(actor_profile),
        active_contexts: listActiveContexts(),
        common_tenant: policy.commonTenant,
        admin_profiles: policy.adminProfiles
      })
  );

  server.registerTool(
    'nexus_rag_search',
    {
      title: 'Search NexusAI RAG',
      description: 'Search approved NexusAI and active-client RAG tenants with tenant isolation.',
      inputSchema: {
        query: z.string().min(1),
        actor_profile: actorProfileSchema,
        client_id: z.string().min(1).optional(),
        tenant_ids: z.array(z.string().min(1)).optional(),
        purpose: z.string().optional(),
        limit: z.number().int().positive().optional(),
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        const activeClient = input.client_id ?? getActiveClient(input.actor_profile);
        const scope = assertTenantAccess({
          actorProfile: input.actor_profile,
          activeClient,
          requestedTenants: input.tenant_ids,
          adminMode: input.admin_mode,
          policy
        });
        const limit = clampLimit(input.limit, policy);
        const [queryEmbedding] = await embeddingProvider.embed([input.query]);
        const results = await repository.searchChunks({
          query: input.query,
          allowedTenants: scope.allowedTenants,
          limit,
          queryEmbedding: queryEmbedding ?? undefined
        });

        await repository.recordQuery({
          actorProfile: input.actor_profile,
          activeClient,
          allowedTenants: scope.allowedTenants,
          query: input.query,
          purpose: input.purpose,
          resultCount: results.length
        });

        return jsonToolResult({
          query: input.query,
          purpose: input.purpose,
          actor_profile: input.actor_profile,
          active_client: activeClient,
          allowed_tenants: scope.allowedTenants,
          result_count: results.length,
          search_mode: queryEmbedding ? 'hybrid_vector_fts' : 'full_text',
          results
        });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'search', input.tenant_ids, error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_rag_list_sources',
    {
      title: 'List NexusAI RAG Sources',
      description: 'List documents for an allowed tenant.',
      inputSchema: {
        tenant_id: z.string().min(1),
        actor_profile: actorProfileSchema,
        client_id: z.string().min(1).optional(),
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        assertTenantAccess({
          actorProfile: input.actor_profile,
          activeClient: input.client_id ?? getActiveClient(input.actor_profile),
          requestedTenants: [input.tenant_id],
          adminMode: input.admin_mode,
          policy
        });

        const sources = await repository.listSources(input.tenant_id);
        return jsonToolResult({ tenant_id: input.tenant_id, count: sources.length, sources });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'list_sources', [input.tenant_id], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_rag_get_document',
    {
      title: 'Get NexusAI RAG Document',
      description: 'Get one document and its chunks after tenant access is validated.',
      inputSchema: {
        document_id: z.string().uuid(),
        tenant_id: z.string().min(1),
        actor_profile: actorProfileSchema,
        client_id: z.string().min(1).optional(),
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        assertTenantAccess({
          actorProfile: input.actor_profile,
          activeClient: input.client_id ?? getActiveClient(input.actor_profile),
          requestedTenants: [input.tenant_id],
          adminMode: input.admin_mode,
          policy
        });

        const document = await repository.getDocument(input.document_id);
        if (!document) {
          return jsonToolResult({ document_id: input.document_id, found: false });
        }

        if (document.tenant !== input.tenant_id) {
          throw new TenantAccessError(`Access denied: document is not in tenant ${input.tenant_id}.`);
        }

        return jsonToolResult({ document_id: input.document_id, found: true, document });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'get_document', [input.tenant_id], error, input.document_id);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_rag_get_ens_course_context',
    {
      title: 'Get Full ENS Course Context',
      description: 'ENS-only helper that returns all ingested chunks for one ENS course, grouped for Hermes copy/strategy work.',
      inputSchema: {
        course_name: z.string().min(1),
        actor_profile: actorProfileSchema,
        client_id: z.string().min(1).optional(),
        tenant_id: z.literal('ens').default('ens')
      }
    },
    async input => {
      try {
        assertTenantAccess({
          actorProfile: input.actor_profile,
          activeClient: input.client_id ?? getActiveClient(input.actor_profile),
          requestedTenants: ['ens'],
          adminMode: false,
          policy
        });

        const candidates = await repository.findDocumentsByTitle({
          tenantSlug: 'ens',
          sourceId: 'ens_courses',
          title: input.course_name,
          limit: 10
        });

        if (candidates.length === 0) {
          return jsonToolResult({
            found: false,
            tenant_id: 'ens',
            source_id: 'ens_courses',
            course_name: input.course_name,
            message: 'No ENS course document matched the requested course name.'
          });
        }

        const selected = candidates[0];
        const document = await repository.getDocument(selected.id);
        if (!document || document.tenant !== 'ens') {
          return jsonToolResult({
            found: false,
            tenant_id: 'ens',
            source_id: 'ens_courses',
            course_name: input.course_name,
            candidates
          });
        }

        const context = buildEnsCourseContext(document);
        return jsonToolResult({
          found: true,
          tenant_id: 'ens',
          source_id: 'ens_courses',
          requested_course_name: input.course_name,
          selected_course_title: selected.title,
          candidates: candidates.map(candidate => ({
            id: candidate.id,
            title: candidate.title,
            source_key: candidate.metadata.source_key ?? candidate.metadata.id_academico
          })),
          context
        } as unknown as Record<string, unknown>);
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'get_ens_course_context', ['ens'], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_rag_ingest_source',
    {
      title: 'Ingest NexusAI RAG Source',
      description: 'Refresh a controlled RAG source. ENS rules apply only to ens_courses.',
      inputSchema: {
        source_id: z.enum(['ens_courses', 'nexusai_manual']),
        tenant_id: z.string().min(1),
        actor_profile: actorProfileSchema,
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: ingest_source requires admin_mode from an admin profile.');
        }

        if (input.source_id === 'ens_courses' && input.tenant_id !== 'ens') {
          throw new TenantAccessError('Access denied: ens_courses can only ingest into tenant ens.');
        }

        if (input.source_id === 'nexusai_manual' && input.tenant_id !== policy.commonTenant) {
          throw new TenantAccessError(`Access denied: nexusai_manual can only ingest into tenant ${policy.commonTenant}.`);
        }

        const result = await ingestionService.refreshSource({
          sourceId: input.source_id,
          tenantSlug: input.tenant_id
        });

        return jsonToolResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'ingest_source', [input.tenant_id], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_rag_audit_recent',
    {
      title: 'Recent NexusAI RAG Audit Events',
      description: 'Show recent RAG audit events. Requires an admin profile with admin_mode true.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        limit: z.number().int().positive().optional(),
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: audit_recent requires admin_mode from an admin profile.');
        }

        const events = await repository.auditRecent(clampLimit(input.limit, policy));
        return jsonToolResult({ count: events.length, events });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'audit_recent', undefined, error);
        return toolError(error);
      }
    }
  );

  return server;
}

function toTenantPolicy(config: AppConfig): TenantPolicyConfig {
  return {
    commonTenant: config.policy.common_tenant,
    adminProfiles: config.policy.admin_profiles,
    defaultLimit: config.policy.default_limit,
    maxLimit: config.policy.max_limit
  };
}

function clampLimit(limit: number | undefined, policy: TenantPolicyConfig): number {
  return Math.min(limit ?? policy.defaultLimit, policy.maxLimit);
}

function toolError(error: unknown) {
  if (error instanceof Error) {
    return errorToolResult(error.message);
  }

  return errorToolResult('Unknown tool error', error);
}

async function auditDenied(
  repository: RagRepository,
  actorProfile: string,
  action: string,
  tenants: string[] | undefined,
  error: unknown,
  documentId?: string
): Promise<void> {
  if (!(error instanceof TenantAccessError)) {
    return;
  }

  await Promise.all(
    (tenants?.length ? tenants : [undefined]).map(tenant =>
      repository.recordAuditEvent({
        actorProfile,
        action,
        tenant,
        documentId,
        allowed: false,
        reason: error.message
      })
    )
  );
}
