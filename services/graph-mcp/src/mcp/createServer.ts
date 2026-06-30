import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type Neo4jGraphRepository, type RelateInput, type UpsertFactInput } from '../graph/repository.js';
import { resolveGraphContext } from '../graph/schema.js';
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
  'journey_stage'
]);

export function createNexusGraphMcpServer({ repository }: ServerDependencies): McpServer {
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
        'Use nexus_graph_upsert_fact for durable business/system/product facts.',
        'Use nexus_graph_relate to connect facts.',
        'Use nexus_graph_neighbors or nexus_graph_query for reasoning over relationships.'
      ]
    })
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
        properties: z.record(z.unknown()).default({})
      }
    },
    async input => {
      try {
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
        properties: z.record(z.unknown()).default({})
      }
    },
    async input => {
      try {
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
