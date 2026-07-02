import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  buildRagGraphSyncPlan,
  fetchRagGraphSyncSources,
  type RagGraphSyncCollection
} from '../graph/ragSync.js';
import { type Neo4jGraphRepository, type RelateInput, type UpsertFactInput } from '../graph/repository.js';
import { resolveGraphContext } from '../graph/schema.js';
import {
  buildValidatedWorkGraphId,
  buildValidatedWorkGraphProperties,
  summarizeValidatedWork,
  SupabaseValidatedWorkRepository,
  VALIDATED_WORK_TYPES
} from '../graph/validatedWorks.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

export type ServerDependencies = {
  repository: Neo4jGraphRepository;
};

const tenantContextSchema = {
  tenant_id: z.string().min(1).optional().describe('White-label tenant/workspace id. Defaults to NEXUS_TENANT_ID or public.'),
  user_id: z.string().min(1).optional().describe('Optional end-user id for private/user-scoped context.')
};

const graphKindSchema = z.enum([
  'domain',
  'capability',
  'process',
  'entity',
  'metric',
  'system',
  'note',
  'decision',
  'risk',
  'integration',
  'journey_stage',
  'course_ref',
  'marketing_ref',
  'insight_ref',
  'institutional_ref',
  'validated_work_ref',
  'persona',
  'campaign',
  'channel',
  'offer',
  'kpi'
]);

const ragGraphSyncCollectionSchema = z.enum(['courses', 'marketing', 'insights', 'institutional']);
const validatedWorkTypeSchema = z.enum(VALIDATED_WORK_TYPES);

const validatedGraphWriteSchema = {
  validated: z.boolean().default(false).describe('Must be true only when the user explicitly approved this durable graph write.'),
  validation_note: z.string().optional().describe('Short note explaining who/what validated this durable graph write.')
};

export function assertValidatedGraphWrite(input: { validated?: boolean; validation_note?: string }): void {
  if (!input.validated) {
    throw new Error('Graph write blocked: explicit validation is required before changing durable relational memory.');
  }
  if (!input.validation_note?.trim()) {
    throw new Error('Graph write blocked: validation note is required before changing durable relational memory.');
  }
}

export function createNexusGraphMcpServer({ repository }: ServerDependencies): McpServer {
  const validatedWorks = new SupabaseValidatedWorkRepository({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  });

  const server = new McpServer({
    name: 'nexus-graph-mcp',
    version: '0.1.0'
  });

  server.registerTool(
    'nexus_graph_guidance',
    {
      title: 'Nexus Graph Guidance',
      description: 'Explain when to use the Nexus graph versus RAG and how the white-label schema is organized.',
      inputSchema: {
        topic: z.string().optional()
      }
    },
    async input => jsonToolResult({
      topic: input.topic ?? 'general',
      use_graph_when: [
        'The user asks how business entities, systems, campaigns, journeys, products, metrics, or teams relate.',
        'The user needs impact analysis, dependency mapping, architecture reasoning, or operating-model memory.',
        'The answer benefits from structured relationships rather than long-form document evidence.'
      ],
      use_rag_when: [
        'The user asks for grounded institutional, course, marketing, policy, or document content.',
        'The answer needs citations or direct source-backed facts from indexed documents.'
      ],
      default_domains: ['Marketing', 'TI', 'Produtos'],
      tenant_model: 'Every node and relationship is scoped by tenant_id. Keep generic white-label facts in the tenant graph and user-specific preferences outside global facts.',
      recommended_flow: [
        'Call nexus_graph_bootstrap for a new tenant or after deploy.',
        'Use nexus_graph_search before creating duplicate nodes.',
        'Use nexus_graph_search_validated_work before generating copy/campaign/briefing/insight/decision/prompt/strategy when reuse may help.',
        'Use nexus_graph_save_validated_work only after the user explicitly approves saving the generated artifact as validated memory.',
        'Use nexus_graph_deprecate_validated_work only for admin or manager sessions; member sessions may read and reuse but must not alter or deprecate validated memory.',
        'Use nexus_graph_upsert_fact for durable business/system/product facts only after explicit validation.',
        'Use nexus_graph_relate to connect facts only after explicit validation.',
        'Use nexus_graph_sync_rag_refs to sync lightweight RAG references into Graph after admin validation.',
        'Use nexus_graph_neighbors or nexus_graph_query for reasoning over relationships.'
      ]
    })
  );

  server.registerTool(
    'nexus_graph_search_validated_work',
    {
      title: 'Search Validated ENS Work Memory',
      description: 'Search shared tenant memory for validated work artifacts such as copy, campaign, briefing, insight, decision, prompt, or strategy.',
      inputSchema: {
        ...tenantContextSchema,
        artifact_type: validatedWorkTypeSchema.optional(),
        query: z.string().optional(),
        related_course_title: z.string().optional(),
        include_deprecated: z.boolean().default(false),
        limit: z.number().int().positive().max(50).default(10)
      }
    },
    async input => {
      try {
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const results = await validatedWorks.search(context, {
          artifact_type: input.artifact_type,
          query: input.query,
          related_course_title: input.related_course_title,
          include_deprecated: input.include_deprecated,
          limit: input.limit
        });
        return jsonToolResult({
          ok: true,
          tenant_id: context.tenantId,
          count: results.length,
          results: results.map(summarizeValidatedWork)
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_save_validated_work',
    {
      title: 'Save Validated ENS Work Memory',
      description: 'Save a user-approved generated artifact into shared ENS validated memory and create a lightweight Graph reference.',
      inputSchema: {
        ...tenantContextSchema,
        user_id: z.string().min(1).describe('Current authenticated frontend user id. Required for author/validator audit.'),
        artifact_type: validatedWorkTypeSchema,
        title: z.string().min(1).max(180),
        content: z.string().min(1).max(30000),
        related_course_id: z.string().optional(),
        related_course_title: z.string().optional(),
        related_rag_source_id: z.string().optional(),
        tags: z.array(z.string()).default([]),
        metadata: z.record(z.unknown()).default({}),
        ...validatedGraphWriteSchema
      }
    },
    async input => {
      try {
        assertValidatedGraphWrite(input);
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const record = await validatedWorks.save(context, {
          user_id: input.user_id,
          artifact_type: input.artifact_type,
          title: input.title,
          content: input.content,
          related_course_id: input.related_course_id,
          related_course_title: input.related_course_title,
          related_rag_source_id: input.related_rag_source_id,
          tags: input.tags,
          metadata: input.metadata,
          validated: input.validated,
          validation_note: input.validation_note
        });
        await repository.upsertFact(context, {
          id: buildValidatedWorkGraphId(record.id),
          kind: 'validated_work_ref',
          label: record.title,
          description: [
            `${record.artifact_type} validado`,
            record.related_course_title ? `para ${record.related_course_title}` : '',
            record.validated_by_name ? `por ${record.validated_by_name}` : ''
          ].filter(Boolean).join(' '),
          aliases: [record.title, record.related_course_title ?? '', ...(record.tags ?? [])].filter(Boolean),
          source: 'validated_work_memory',
          properties: buildValidatedWorkGraphProperties(record)
        });
        return jsonToolResult({
          ok: true,
          tenant_id: context.tenantId,
          record: summarizeValidatedWork(record),
          graph_node_id: buildValidatedWorkGraphId(record.id)
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_deprecate_validated_work',
    {
      title: 'Deprecate Validated ENS Work Memory',
      description: 'Admin/manager-only soft delete for a validated work artifact. Member sessions must not use this tool.',
      inputSchema: {
        ...tenantContextSchema,
        user_id: z.string().min(1).describe('Current authenticated frontend user id. Must be admin or manager in profiles.'),
        id: z.string().uuid(),
        reason: z.string().optional(),
        ...validatedGraphWriteSchema
      }
    },
    async input => {
      try {
        assertValidatedGraphWrite(input);
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const record = await validatedWorks.deprecate(context, {
          id: input.id,
          reason: input.reason,
          user_id: input.user_id
        });
        await repository.upsertFact(context, {
          id: buildValidatedWorkGraphId(record.id),
          kind: 'validated_work_ref',
          label: record.title,
          description: `${record.artifact_type} arquivado/deprecado na memoria validada ENS.`,
          aliases: [record.title, record.related_course_title ?? '', ...(record.tags ?? [])].filter(Boolean),
          source: 'validated_work_memory',
          properties: buildValidatedWorkGraphProperties(record)
        });
        return jsonToolResult({
          ok: true,
          tenant_id: context.tenantId,
          record: summarizeValidatedWork(record),
          graph_node_id: buildValidatedWorkGraphId(record.id)
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_sync_rag_refs',
    {
      title: 'Sync ENS RAG References To Graph',
      description: 'Admin-only sync that imports lightweight ENS RAG source references into Graph as relationship pointers, never full document bodies.',
      inputSchema: {
        ...tenantContextSchema,
        collections: z.array(ragGraphSyncCollectionSchema).default(['courses', 'marketing', 'insights', 'institutional']),
        limit: z.number().int().positive().max(500).default(100),
        rag_internal_url: z.string().url().optional(),
        bootstrap_first: z.boolean().default(true),
        dry_run: z.boolean().default(false),
        actor_profile: z.string().min(1).default('default'),
        admin_mode: z.boolean().default(false),
        ...validatedGraphWriteSchema
      }
    },
    async input => {
      try {
        if (!input.admin_mode) {
          throw new Error('Graph RAG sync blocked: admin_mode=true is required.');
        }
        assertValidatedGraphWrite(input);
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        if (input.bootstrap_first && !input.dry_run) {
          await repository.bootstrap(context);
        }
        const sources = await fetchRagGraphSyncSources({
          ragInternalUrl: input.rag_internal_url ?? process.env.NEXUS_RAG_INTERNAL_URL ?? process.env.NEXUS_RAG_MCP_URL ?? 'http://rag-mcp:8000/internal/graph-sync/sources',
          tenantId: context.tenantId,
          collections: input.collections as RagGraphSyncCollection[],
          limit: input.limit,
          internalKey: process.env.NEXUS_INTERNAL_SYNC_KEY
        });
        const plan = buildRagGraphSyncPlan({ tenantId: context.tenantId, sources });
        if (input.dry_run) {
          return jsonToolResult({
            ok: true,
            dry_run: true,
            tenant_id: context.tenantId,
            source_count: sources.length,
            fact_count: plan.facts.length,
            relation_count: plan.relations.length,
            facts: plan.facts,
            relations: plan.relations
          });
        }

        for (const fact of plan.facts) {
          await repository.upsertFact(context, fact);
        }
        for (const relation of plan.relations) {
          await repository.relate(context, relation);
        }

        return jsonToolResult({
          ok: true,
          tenant_id: context.tenantId,
          source_count: sources.length,
          fact_count: plan.facts.length,
          relation_count: plan.relations.length,
          validation_note: input.validation_note
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_health',
    {
      title: 'Nexus Graph Health',
      description: 'Check Neo4j connectivity and current graph context.',
      inputSchema: tenantContextSchema
    },
    async input => {
      try {
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        return jsonToolResult(await repository.health(context));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_bootstrap',
    {
      title: 'Bootstrap Nexus Graph',
      description: 'Create constraints and seed a generic white-label graph for Marketing, TI, and Produtos.',
      inputSchema: tenantContextSchema
    },
    async input => {
      try {
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        return jsonToolResult(await repository.bootstrap(context));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_search',
    {
      title: 'Search Nexus Graph',
      description: 'Search tenant-scoped graph nodes by label, description, or aliases.',
      inputSchema: {
        ...tenantContextSchema,
        query: z.string().min(1),
        limit: z.number().int().positive().max(50).default(10)
      }
    },
    async input => {
      try {
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const results = await repository.search(context, input.query, input.limit);
        return jsonToolResult({ tenant_id: context.tenantId, query: input.query, results, count: results.length });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_neighbors',
    {
      title: 'Get Nexus Graph Neighbors',
      description: 'Load related tenant-scoped graph nodes around one node id.',
      inputSchema: {
        ...tenantContextSchema,
        node_id: z.string().min(1),
        depth: z.number().int().positive().max(3).default(1),
        limit: z.number().int().positive().max(100).default(50)
      }
    },
    async input => {
      try {
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const results = await repository.neighbors(context, input.node_id, input.depth, input.limit);
        return jsonToolResult({ tenant_id: context.tenantId, node_id: input.node_id, results, count: results.length });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_query',
    {
      title: 'Read Nexus Graph With Cypher',
      description: 'Run a read-only, tenant-scoped Cypher query. The query must explicitly filter by tenant_id and can use $tenant_id.',
      inputSchema: {
        ...tenantContextSchema,
        cypher: z.string().min(1),
        params: z.record(z.unknown()).default({})
      }
    },
    async input => {
      try {
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const results = await repository.query(context, input.cypher, input.params);
        return jsonToolResult({ tenant_id: context.tenantId, results, count: results.length });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_upsert_fact',
    {
      title: 'Upsert Nexus Graph Fact',
      description: 'Create or update a durable tenant-scoped business, product, marketing, IT, metric, risk, or journey fact.',
      inputSchema: {
        ...tenantContextSchema,
        id: z.string().min(1).optional(),
        kind: graphKindSchema,
        label: z.string().min(1),
        description: z.string().min(1),
        aliases: z.array(z.string()).default([]),
        source: z.string().optional(),
        properties: z.record(z.unknown()).default({}),
        ...validatedGraphWriteSchema
      }
    },
    async input => {
      try {
        assertValidatedGraphWrite(input);
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const fact: UpsertFactInput = {
          id: input.id,
          kind: input.kind,
          label: input.label,
          description: input.description,
          aliases: input.aliases,
          source: input.source,
          properties: input.properties
        };
        return jsonToolResult(await repository.upsertFact(context, fact));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'nexus_graph_relate',
    {
      title: 'Relate Nexus Graph Facts',
      description: 'Create or update a tenant-scoped relationship between two graph facts.',
      inputSchema: {
        ...tenantContextSchema,
        from_id: z.string().min(1),
        to_id: z.string().min(1),
        type: z.string().min(1),
        description: z.string().optional(),
        properties: z.record(z.unknown()).default({}),
        ...validatedGraphWriteSchema
      }
    },
    async input => {
      try {
        assertValidatedGraphWrite(input);
        const context = resolveGraphContext({ tenantId: input.tenant_id, userId: input.user_id });
        const relation: RelateInput = {
          fromId: input.from_id,
          toId: input.to_id,
          type: input.type,
          description: input.description,
          properties: input.properties
        };
        return jsonToolResult(await repository.relate(context, relation));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  return server;
}

function toolError(error: unknown) {
  return errorToolResult(
    error instanceof Error ? error.message : 'Unknown graph MCP error',
    error instanceof Error ? { name: error.name } : error
  );
}
