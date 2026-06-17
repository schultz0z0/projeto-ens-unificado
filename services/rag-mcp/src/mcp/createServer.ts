import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { AppConfig } from '../config/schema.js';
import { createEmbeddingProviderFromEnv } from '../ingestion/embeddings/embeddingProvider.js';
import { IngestionService } from '../ingestion/ingestionService.js';
import { buildEnsCourseContext } from '../ingestion/sources/ens/ensCourseContext.js';
import { buildCourseSearchFilters } from '../policy/courseSearchPolicy.js';
import {
  assertMarketingValidation,
  defaultCollectionsForIntent,
  normalizeCollections
} from '../policy/collectionPolicy.js';
import { TenantAccessError, type TenantPolicyConfig } from '../policy/tenantPolicy.js';
import { createRagRerankerFromEnv } from '../rag/reranker.js';
import type { EnsRagCollection, RagCourseSearchFilters, RagRepository, RagSearchIntent } from '../rag/types.js';
import { collectionSchema, courseFiltersSchema, marketingCategorySchema, searchIntentSchema } from './ensToolSchemas.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

export type ServerDependencies = {
  config: AppConfig;
  repository: RagRepository;
};

const actorProfileSchema = z.string().min(1).default('default');

export function createEnsRagMcpServer({ config, repository }: ServerDependencies): McpServer {
  const server = new McpServer({
    name: 'ens-rag-mcp',
    version: '0.1.0'
  });

  const policy = toTenantPolicy(config);
  const embeddingProvider = createEmbeddingProviderFromEnv();
  const ingestionService = new IngestionService(repository, embeddingProvider);
  const reranker = createRagRerankerFromEnv();

  server.registerTool(
    'ens_rag_search',
    {
      title: 'Search ENS RAG Collections',
      description: 'Search ENS knowledge collections with collection routing and freshness controls.',
      inputSchema: {
        query: z.string().min(1),
        collections: z.array(collectionSchema).optional(),
        intent: searchIntentSchema.optional(),
        limit: z.number().int().positive().optional(),
        freshness_days: z.number().int().positive().optional(),
        include_stale: z.boolean().optional(),
        course_filters: courseFiltersSchema,
        require_evidence: z.boolean().default(true),
        actor_profile: actorProfileSchema
      }
    },
    async input => {
      try {
        const collections = normalizeCollections(input.collections ?? defaultCollectionsForIntent(input.intent as RagSearchIntent));
        const requestedLimit = clampLimit(input.limit, policy);
        const candidateLimit = candidateLimitFor(requestedLimit);
        const courseFilters = buildCourseSearchFilters({
          query: input.query,
          collections,
          intent: input.intent as RagSearchIntent | undefined,
          explicitFilters: toCourseFilters(input.course_filters)
        });
        const [queryEmbedding] = await embeddingProvider.embed([input.query]);
        const candidateResults = await repository.searchChunks({
          query: input.query,
          allowedTenants: ['ens'],
          collections,
          limit: candidateLimit,
          queryEmbedding: queryEmbedding ?? undefined,
          freshnessDays: input.freshness_days,
          includeStale: input.include_stale ?? !['analytics', 'marketing_strategy'].includes(input.intent ?? ''),
          intent: input.intent as RagSearchIntent | undefined,
          courseFilters
        });
        const reranked = await reranker.rerank({
          query: input.query,
          intent: input.intent as RagSearchIntent | undefined,
          requestedLimit,
          results: candidateResults
        });
        const results = reranked.results;

        await repository.recordQuery({
          actorProfile: input.actor_profile,
          activeClient: 'ens',
          allowedTenants: ['ens'],
          query: input.query,
          purpose: input.intent,
          resultCount: results.length
        });

        return jsonToolResult({
          query: input.query,
          actor_profile: input.actor_profile,
          collections,
          course_filters: courseFilters,
          candidate_count: candidateResults.length,
          result_count: results.length,
          require_evidence: input.require_evidence,
          search_mode: queryEmbedding ? 'advanced_hybrid_vector_fts' : 'advanced_full_text',
          reranker: {
            mode: reranked.mode,
            applied: reranked.applied,
            warning: reranked.warning
          },
          warning: input.require_evidence && results.length === 0 ? 'No grounded ENS evidence found for this query.' : undefined,
          results
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_get_document',
    {
      title: 'Get ENS RAG Document',
      description: 'Load a full ENS document and its chunks, optionally constrained to an expected collection.',
      inputSchema: {
        document_id: z.string().uuid(),
        expected_collection: collectionSchema.optional(),
        actor_profile: actorProfileSchema
      }
    },
    async input => {
      try {
        const document = await repository.getDocument(input.document_id);
        if (!document) {
          return jsonToolResult({ document_id: input.document_id, found: false });
        }

        if (document.tenant !== 'ens') {
          throw new TenantAccessError('Access denied: document is not in the ENS tenant.');
        }

        if (input.expected_collection && document.collection !== input.expected_collection) {
          throw new Error(`Document collection mismatch: expected ${input.expected_collection}, received ${document.collection}.`);
        }

        return jsonToolResult({ document_id: input.document_id, found: true, document });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_get_course_context',
    {
      title: 'Get ENS Course Context',
      description: 'Load the full grounded course context for one ENS course.',
      inputSchema: {
        course_name: z.string().min(1),
        actor_profile: actorProfileSchema
      }
    },
    async input => {
      try {
        const candidates = await repository.findDocumentsByTitle({
          tenantSlug: 'ens',
          sourceId: 'ens_courses',
          title: input.course_name,
          limit: 10
        });

        if (candidates.length === 0) {
          return jsonToolResult({
            found: false,
            collection: 'courses',
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
            collection: 'courses',
            source_id: 'ens_courses',
            course_name: input.course_name,
            candidates
          });
        }

        return jsonToolResult({
          found: true,
          collection: 'courses',
          source_id: 'ens_courses',
          requested_course_name: input.course_name,
          selected_course_title: selected.title,
          candidates: candidates.map(candidate => ({
            id: candidate.id,
            title: candidate.title,
            source_key: candidate.metadata.source_key ?? candidate.metadata.id_academico
          })),
          context: buildEnsCourseContext(document)
        } as unknown as Record<string, unknown>);
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_ingest_courses',
    {
      title: 'Ingest ENS Courses',
      description: 'Refresh the ENS courses collection from the ENS site API.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: ens_rag_ingest_courses requires admin_mode from an admin profile.');
        }

        const result = await ingestionService.refreshSource({
          sourceId: 'ens_courses',
          tenantSlug: 'ens'
        });

        return jsonToolResult({
          ...result,
          collection: 'courses'
        });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'ens_ingest_courses', ['ens'], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_ingest_institutional',
    {
      title: 'Ingest ENS Institutional Knowledge',
      description: 'Refresh the ENS institutional collection from versioned Markdown files.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: ens_rag_ingest_institutional requires admin_mode from an admin profile.');
        }

        const result = await ingestionService.refreshSource({
          sourceId: 'ens_institutional_manual',
          tenantSlug: 'ens'
        });

        return jsonToolResult({
          ...result,
          collection: 'institutional'
        });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'ens_ingest_institutional', ['ens'], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_ingest_marketing',
    {
      title: 'Ingest ENS Marketing Knowledge',
      description: 'Refresh the ENS marketing collection from versioned Markdown files.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: ens_rag_ingest_marketing requires admin_mode from an admin profile.');
        }

        const result = await ingestionService.refreshSource({
          sourceId: 'ens_marketing_manual',
          tenantSlug: 'ens'
        });

        return jsonToolResult({
          ...result,
          collection: 'marketing'
        });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'ens_ingest_marketing', ['ens'], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_ingest_insights',
    {
      title: 'Ingest ENS Insights Knowledge',
      description: 'Refresh the ENS insights collection from versioned Markdown files.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: ens_rag_ingest_insights requires admin_mode from an admin profile.');
        }

        const result = await ingestionService.refreshSource({
          sourceId: 'ens_insights_manual',
          tenantSlug: 'ens'
        });

        return jsonToolResult({
          ...result,
          collection: 'insights'
        });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'ens_ingest_insights', ['ens'], error);
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_save_insight',
    {
      title: 'Save ENS Insight',
      description: 'Save a dated ENS analytical insight into the insights collection.',
      inputSchema: {
        title: z.string().min(1),
        summary: z.string().min(1),
        analysis: z.string().min(1),
        subject: z.string().min(1),
        analysis_date: z.string().optional(),
        related_course: z.string().optional(),
        campaign_or_funnel: z.string().optional(),
        metrics_period: z.string().optional(),
        confidence: z.enum(['low', 'medium', 'high']).optional(),
        stale_after_days: z.number().int().positive().optional(),
        evidence: z.array(z.string().min(1)).optional(),
        actor_profile: actorProfileSchema
      }
    },
    async input => {
      try {
        const chunkPayloads = [
          {
            kind: 'insight_summary',
            content: input.summary,
            metadata: { section: 'summary', subject: input.subject }
          },
          {
            kind: 'insight_analysis',
            content: input.analysis,
            metadata: { section: 'analysis', subject: input.subject }
          }
        ];
        const embeddings = await embeddingProvider.embed(chunkPayloads.map(chunk => chunk.content));
        const document = await repository.insertKnowledgeDocument({
          collection: 'insights',
          title: input.title,
          sourceId: 'hermes_insight',
          sourceKey: `${Date.now()}-${slugify(input.title)}`,
          sourceType: 'hermes_analysis',
          visibility: 'internal',
          metadata: {
            subject: input.subject,
            analysis_date: input.analysis_date ?? new Date().toISOString(),
            related_course: input.related_course ?? null,
            campaign_or_funnel: input.campaign_or_funnel ?? null,
            metrics_period: input.metrics_period ?? null,
            confidence: input.confidence ?? null,
            stale_after_days: input.stale_after_days ?? null,
            evidence: input.evidence ?? [],
            actor_profile: input.actor_profile
          },
          chunks: chunkPayloads.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index] ?? null,
            embeddingModel: embeddings[index] ? embeddingProvider.model : undefined
          }))
        });

        await repository.recordAuditEvent({
          actorProfile: input.actor_profile,
          action: 'save:insight',
          tenant: 'ens',
          documentId: document.id,
          allowed: true,
          reason: `Saved ENS insight in collection insights.`
        });

        return jsonToolResult({ ok: true, collection: 'insights', document });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_save_marketing_memory',
    {
      title: 'Save ENS Marketing Memory',
      description: 'Save validated ENS marketing knowledge into the marketing collection.',
      inputSchema: {
        title: z.string().min(1),
        content: z.string().min(1),
        category: marketingCategorySchema,
        user_validated: z.boolean(),
        validation_note: z.string().min(1),
        related_course: z.string().optional(),
        campaign_name: z.string().optional(),
        actor_profile: actorProfileSchema
      }
    },
    async input => {
      try {
        assertMarketingValidation({
          userValidated: input.user_validated,
          validationNote: input.validation_note
        });

        const [embedding] = await embeddingProvider.embed([input.content]);
        const document = await repository.insertKnowledgeDocument({
          collection: 'marketing',
          title: input.title,
          sourceId: 'hermes_marketing_memory',
          sourceKey: `${Date.now()}-${slugify(input.title)}`,
          sourceType: 'validated_marketing_memory',
          visibility: 'internal',
          metadata: {
            category: input.category,
            validation_note: input.validation_note,
            validated_at: new Date().toISOString(),
            validated_by: input.actor_profile,
            related_course: input.related_course ?? null,
            campaign_name: input.campaign_name ?? null
          },
          chunks: [
            {
              kind: 'marketing_memory',
              content: input.content,
              metadata: {
                section: 'marketing_memory',
                category: input.category
              },
              embedding,
              embeddingModel: embedding ? embeddingProvider.model : undefined
            }
          ]
        });

        await repository.recordAuditEvent({
          actorProfile: input.actor_profile,
          action: 'save:marketing_memory',
          tenant: 'ens',
          documentId: document.id,
          allowed: true,
          reason: `Saved validated ENS marketing memory.`
        });

        return jsonToolResult({ ok: true, collection: 'marketing', document });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_list_collections',
    {
      title: 'List ENS RAG Collections',
      description: 'Show available ENS collections with counts and freshness hints.',
      inputSchema: {
        actor_profile: actorProfileSchema
      }
    },
    async () => {
      try {
        const collections = await repository.listCollections();
        return jsonToolResult({
          count: collections.length,
          collections: collections.map(item => ({
            ...item,
            purpose: collectionPurpose(item.collection)
          }))
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'ens_rag_audit_recent',
    {
      title: 'Recent ENS RAG Audit Events',
      description: 'Show recent ENS RAG audit events. Requires an admin profile with admin_mode true.',
      inputSchema: {
        actor_profile: actorProfileSchema,
        limit: z.number().int().positive().optional(),
        admin_mode: z.boolean().default(false)
      }
    },
    async input => {
      try {
        if (!input.admin_mode || !policy.adminProfiles.includes(input.actor_profile)) {
          throw new TenantAccessError('Access denied: ens_rag_audit_recent requires admin_mode from an admin profile.');
        }

        const events = await repository.auditRecent(clampLimit(input.limit, policy));
        return jsonToolResult({ count: events.length, events });
      } catch (error) {
        await auditDenied(repository, input.actor_profile, 'ens_audit_recent', ['ens'], error);
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

function candidateLimitFor(requestedLimit: number): number {
  return Math.min(Math.max(requestedLimit * 3, requestedLimit), 50);
}

function toCourseFilters(input: unknown): RagCourseSearchFilters | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const filters = input as {
    chunk_kinds?: string[];
    course_categories?: string[];
    course_types?: string[];
    course_statuses?: string[];
    offer_statuses?: string[];
    modalities?: string[];
    localities?: string[];
    only_active_offers?: boolean;
    offer_start_from?: string;
    offer_start_to?: string;
    enrollment_open_at?: string;
  };

  return {
    chunkKinds: filters.chunk_kinds,
    courseCategories: filters.course_categories,
    courseTypes: filters.course_types,
    courseStatuses: filters.course_statuses,
    offerStatuses: filters.offer_statuses,
    modalities: filters.modalities,
    localities: filters.localities,
    onlyActiveOffers: filters.only_active_offers,
    offerStartFrom: filters.offer_start_from,
    offerStartTo: filters.offer_start_to,
    enrollmentOpenAt: filters.enrollment_open_at
  };
}

function toolError(error: unknown) {
  if (error instanceof Error) {
    return errorToolResult(error.message);
  }

  return errorToolResult('Unknown tool error', error);
}

function collectionPurpose(collection: EnsRagCollection): string {
  switch (collection) {
    case 'courses':
      return 'Grounded ENS course catalog and offers.';
    case 'insights':
      return 'Reusable ENS analytical insights with time sensitivity.';
    case 'institutional':
      return 'Institutional ENS reference knowledge.';
    case 'marketing':
      return 'Validated ENS marketing knowledge and approved learnings.';
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
