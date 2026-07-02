import neo4j, { type Driver } from 'neo4j-driver';
import {
  assertTenantScopedReadOnlyCypher,
  buildBootstrapPlan,
  type GraphContext,
  type SeedNode
} from './schema.js';

export type GraphRepositoryConfig = {
  uri: string;
  username: string;
  password: string;
};

export type GraphQueryRow = Record<string, unknown>;

export type UpsertFactInput = {
  id?: string;
  kind: SeedNode['kind']
    | 'note'
    | 'decision'
    | 'risk'
    | 'integration'
    | 'journey_stage'
    | 'course_ref'
    | 'marketing_ref'
    | 'insight_ref'
    | 'institutional_ref'
    | 'persona'
    | 'campaign'
    | 'channel'
    | 'offer'
    | 'kpi';
  label: string;
  description: string;
  aliases?: string[];
  source?: string;
  properties?: Record<string, unknown>;
};

export type RelateInput = {
  fromId: string;
  toId: string;
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
};

export class Neo4jGraphRepository {
  private readonly driver: Driver;

  constructor(config: GraphRepositoryConfig) {
    this.driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password));
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async health(context: GraphContext): Promise<Record<string, unknown>> {
    await this.driver.verifyConnectivity();
    const rows = await this.read(context, 'RETURN 1 AS ok', {});
    return {
      ok: true,
      database: context.database,
      tenant_id: context.tenantId,
      user_id: context.userId,
      database_strategy: context.databaseStrategy,
      ping: rows[0]?.ok ?? 1
    };
  }

  async bootstrap(context: GraphContext): Promise<Record<string, unknown>> {
    const plan = buildBootstrapPlan(context);
    const session = this.driver.session({ database: context.database });

    try {
      for (const cypher of plan.constraints) {
        await session.executeWrite(tx => tx.run(cypher));
      }
      for (const item of plan.seedNodes) {
        await session.executeWrite(tx => tx.run(item.cypher, item.params));
      }
      for (const item of plan.seedRelations) {
        await session.executeWrite(tx => tx.run(item.cypher, item.params));
      }
      return {
        ok: true,
        database: context.database,
        tenant_id: context.tenantId,
        seed_nodes: plan.seedNodes.length,
        seed_relations: plan.seedRelations.length,
        constraints: plan.constraints.length
      };
    } finally {
      await session.close();
    }
  }

  async query(context: GraphContext, cypher: string, params: Record<string, unknown> = {}): Promise<GraphQueryRow[]> {
    assertTenantScopedReadOnlyCypher(cypher);
    return this.read(context, cypher, { ...params, tenant_id: context.tenantId });
  }

  async search(context: GraphContext, query: string, limit = 10): Promise<GraphQueryRow[]> {
    return this.read(
      context,
      [
        'MATCH (n:NexusGraphNode {tenant_id: $tenant_id})',
        'WHERE toLower(n.label) CONTAINS toLower($query)',
        '   OR toLower(n.description) CONTAINS toLower($query)',
        '   OR any(alias IN coalesce(n.aliases, []) WHERE toLower(alias) CONTAINS toLower($query))',
        'RETURN n.id AS id, n.kind AS kind, n.label AS label, n.description AS description, n.aliases AS aliases',
        'ORDER BY n.kind, n.label',
        buildCypherLimit('limit')
      ].join('\n'),
      { tenant_id: context.tenantId, query, limit: normalizeLimit(limit) }
    );
  }

  async neighbors(context: GraphContext, nodeId: string, depth = 1, limit = 50): Promise<GraphQueryRow[]> {
    const safeDepth = Math.max(1, Math.min(3, Math.floor(depth)));
    return this.read(
      context,
      [
        'MATCH (start:NexusGraphNode {tenant_id: $tenant_id, id: $node_id})',
        `MATCH path = (start)-[r:NEXUS_RELATES*1..${safeDepth}]-(neighbor:NexusGraphNode {tenant_id: $tenant_id})`,
        'WITH start, neighbor, relationships(path) AS rels',
        'RETURN start.id AS start_id,',
        '       neighbor.id AS id,',
        '       neighbor.kind AS kind,',
        '       neighbor.label AS label,',
        '       neighbor.description AS description,',
        '       [rel IN rels | rel.type] AS relation_types',
        buildCypherLimit('limit')
      ].join('\n'),
      { tenant_id: context.tenantId, node_id: nodeId, limit: normalizeLimit(limit, 100) }
    );
  }

  async upsertFact(context: GraphContext, fact: UpsertFactInput): Promise<Record<string, unknown>> {
    const id = fact.id || `${fact.kind}:${slugify(fact.label)}`;
    const properties = sanitizeProperties(fact.properties);
    const rows = await this.write(
      context,
      buildUpsertFactCypher(),
      {
        tenant_id: context.tenantId,
        id,
        kind: fact.kind,
        label: fact.label,
        description: fact.description,
        aliases: fact.aliases ?? [],
        source: fact.source ?? 'nexus_graph_mcp',
        properties
      }
    );

    return { ok: true, tenant_id: context.tenantId, node: rows[0] ?? { id } };
  }

  async relate(context: GraphContext, relation: RelateInput): Promise<Record<string, unknown>> {
    const properties = sanitizeProperties(relation.properties);
    const rows = await this.write(
      context,
      buildRelateCypher(),
      {
        tenant_id: context.tenantId,
        from_id: relation.fromId,
        to_id: relation.toId,
        type: normalizeRelationType(relation.type),
        description: relation.description ?? '',
        properties
      }
    );

    return { ok: rows.length > 0, tenant_id: context.tenantId, relation: rows[0] ?? null };
  }

  private async read(context: GraphContext, cypher: string, params: Record<string, unknown>): Promise<GraphQueryRow[]> {
    const session = this.driver.session({ database: context.database });
    try {
      const result = await session.executeRead(tx => tx.run(cypher, params));
      return result.records.map(recordToObject);
    } finally {
      await session.close();
    }
  }

  private async write(context: GraphContext, cypher: string, params: Record<string, unknown>): Promise<GraphQueryRow[]> {
    const session = this.driver.session({ database: context.database });
    try {
      const result = await session.executeWrite(tx => tx.run(cypher, params));
      return result.records.map(recordToObject);
    } finally {
      await session.close();
    }
  }
}

export function buildUpsertFactCypher(): string {
  return [
    'MERGE (n:NexusGraphNode {tenant_id: $tenant_id, id: $id})',
    'SET n += $properties,',
    '    n.tenant_id = $tenant_id,',
    '    n.id = $id,',
    '    n.kind = $kind,',
    '    n.label = $label,',
    '    n.description = $description,',
    '    n.aliases = $aliases,',
    '    n.source = $source,',
    '    n.updated_at = datetime()',
    'RETURN n.id AS id, n.kind AS kind, n.label AS label, n.description AS description'
  ].join('\n');
}

export function buildRelateCypher(): string {
  return [
    'MATCH (from:NexusGraphNode {tenant_id: $tenant_id, id: $from_id})',
    'MATCH (to:NexusGraphNode {tenant_id: $tenant_id, id: $to_id})',
    'MERGE (from)-[r:NEXUS_RELATES {tenant_id: $tenant_id, type: $type}]->(to)',
    'SET r += $properties,',
    '    r.description = $description,',
    '    r.tenant_id = $tenant_id,',
    '    r.type = $type,',
    '    r.updated_at = datetime()',
    'RETURN from.id AS from_id, r.type AS type, to.id AS to_id, r.description AS description'
  ].join('\n');
}

function recordToObject(record: { keys: readonly PropertyKey[]; get: (key: PropertyKey) => unknown }): GraphQueryRow {
  return Object.fromEntries(record.keys.map(key => [String(key), serializeNeo4jValue(record.get(key))]));
}

function serializeNeo4jValue(value: unknown): unknown {
  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeNeo4jValue);
  }
  if (value && typeof value === 'object') {
    if ('properties' in value && typeof (value as { properties: unknown }).properties === 'object') {
      const graphValue = value as { labels?: string[]; type?: string; properties: Record<string, unknown> };
      return {
        ...(graphValue.labels ? { labels: graphValue.labels } : {}),
        ...(graphValue.type ? { type: graphValue.type } : {}),
        properties: serializeProperties(graphValue.properties)
      };
    }
    return serializeProperties(value as Record<string, unknown>);
  }
  return value;
}

function serializeProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, serializeNeo4jValue(nested)])
  );
}

function sanitizeProperties(value: Record<string, unknown> | undefined): Record<string, string | number | boolean | string[]> {
  if (!value) return {};
  const sanitized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      sanitized[key] = raw;
    } else if (Array.isArray(raw) && raw.every(item => typeof item === 'string')) {
      sanitized[key] = raw;
    }
  }
  return sanitized;
}

export function normalizeLimit(limit: number, max = 50): number {
  const normalized = Number.isFinite(limit) ? Math.floor(limit) : 10;
  return Math.max(1, Math.min(max, normalized));
}

export function buildCypherLimit(paramName: string): string {
  return `LIMIT toInteger($${paramName})`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 96) || 'fact';
}

function normalizeRelationType(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'RELATES_TO';
}
