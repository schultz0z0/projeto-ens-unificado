export type GraphDatabaseStrategy = 'shared' | 'database-per-tenant';

export type GraphContext = {
  tenantId: string;
  userId?: string;
  database: string;
  databaseStrategy: GraphDatabaseStrategy;
};

export type SeedNode = {
  id: string;
  kind: 'domain' | 'capability' | 'process' | 'entity' | 'metric' | 'system';
  label: string;
  description: string;
  aliases?: string[];
};

export type SeedRelation = {
  from: string;
  to: string;
  type: string;
  description: string;
};

export type WhiteLabelSeed = {
  version: string;
  nodes: SeedNode[];
  relations: SeedRelation[];
};

export type CypherPlanItem = {
  cypher: string;
  params: Record<string, unknown>;
};

export type BootstrapPlan = {
  constraints: string[];
  seedNodes: CypherPlanItem[];
  seedRelations: CypherPlanItem[];
};

const TENANT_MAX_LENGTH = 64;
const USER_MAX_LENGTH = 128;

export const DEFAULT_WHITE_LABEL_SEED: WhiteLabelSeed = {
  version: '2026-06-30.generic-business-v1',
  nodes: [
    {
      id: 'domain:marketing',
      kind: 'domain',
      label: 'Marketing',
      description: 'Growth, brand, demand generation, channels, campaigns, and communication strategy.'
    },
    {
      id: 'domain:it',
      kind: 'domain',
      label: 'TI',
      description: 'Systems, infrastructure, integrations, security, automations, and data platforms.'
    },
    {
      id: 'domain:products',
      kind: 'domain',
      label: 'Produtos',
      description: 'Offer catalog, roadmap, customer value, lifecycle, pricing, and product operations.'
    },
    {
      id: 'capability:brand-strategy',
      kind: 'capability',
      label: 'Estrategia de Marca',
      description: 'Positioning, tone of voice, value proposition, brand attributes, and messaging guardrails.'
    },
    {
      id: 'capability:campaign-planning',
      kind: 'capability',
      label: 'Planejamento de Campanhas',
      description: 'Briefs, objectives, offers, channels, audiences, creative routes, and measurement plan.'
    },
    {
      id: 'capability:content-operations',
      kind: 'capability',
      label: 'Operacao de Conteudo',
      description: 'Editorial planning, copy, assets, approvals, publishing, reuse, and governance.'
    },
    {
      id: 'capability:paid-media',
      kind: 'capability',
      label: 'Midia Paga',
      description: 'Acquisition campaigns, budgets, targeting, conversion tracking, and optimization loops.'
    },
    {
      id: 'capability:crm-leads',
      kind: 'capability',
      label: 'CRM e Leads',
      description: 'Lead capture, enrichment, scoring, nurturing, handoff, pipeline stages, and retention.'
    },
    {
      id: 'capability:analytics',
      kind: 'capability',
      label: 'Analytics e KPIs',
      description: 'Dashboards, attribution, funnel metrics, product metrics, experiments, and insights.'
    },
    {
      id: 'capability:integration-architecture',
      kind: 'capability',
      label: 'Arquitetura de Integracoes',
      description: 'APIs, queues, automations, webhooks, internal services, and data contracts.'
    },
    {
      id: 'capability:data-governance',
      kind: 'capability',
      label: 'Governanca de Dados',
      description: 'Ownership, quality, lineage, privacy, access control, schemas, and retention policies.'
    },
    {
      id: 'capability:product-catalog',
      kind: 'capability',
      label: 'Catalogo de Produtos',
      description: 'Products, services, plans, features, pricing, eligibility, positioning, and lifecycle.'
    },
    {
      id: 'capability:roadmap',
      kind: 'capability',
      label: 'Roadmap e Priorizacao',
      description: 'Opportunities, bets, initiatives, dependencies, risks, releases, and success criteria.'
    },
    {
      id: 'process:customer-journey',
      kind: 'process',
      label: 'Jornada do Cliente',
      description: 'Awareness, consideration, conversion, onboarding, activation, retention, and expansion.'
    },
    {
      id: 'entity:persona',
      kind: 'entity',
      label: 'Persona',
      description: 'Customer segment, role, need, objection, channel preference, and decision criteria.'
    },
    {
      id: 'entity:offer',
      kind: 'entity',
      label: 'Oferta',
      description: 'Commercial promise that connects product value, audience, channel, and call to action.'
    },
    {
      id: 'metric:conversion-rate',
      kind: 'metric',
      label: 'Taxa de Conversao',
      description: 'Percentage of users or leads progressing from one journey stage to the next.'
    },
    {
      id: 'metric:cac',
      kind: 'metric',
      label: 'CAC',
      description: 'Customer acquisition cost by channel, campaign, cohort, or product line.'
    },
    {
      id: 'system:source-of-truth',
      kind: 'system',
      label: 'Fonte da Verdade',
      description: 'Primary system or dataset trusted for one business entity or operational process.'
    }
  ],
  relations: [
    { from: 'domain:marketing', to: 'capability:brand-strategy', type: 'OWNS', description: 'Marketing owns brand positioning and messaging.' },
    { from: 'domain:marketing', to: 'capability:campaign-planning', type: 'OWNS', description: 'Marketing owns campaign planning.' },
    { from: 'domain:marketing', to: 'capability:content-operations', type: 'OWNS', description: 'Marketing owns content operations.' },
    { from: 'domain:marketing', to: 'capability:paid-media', type: 'OWNS', description: 'Marketing owns paid media optimization.' },
    { from: 'domain:it', to: 'capability:integration-architecture', type: 'OWNS', description: 'IT owns integration architecture.' },
    { from: 'domain:it', to: 'capability:data-governance', type: 'OWNS', description: 'IT owns data governance foundations with the business.' },
    { from: 'domain:products', to: 'capability:product-catalog', type: 'OWNS', description: 'Product owns catalog structure and product truth.' },
    { from: 'domain:products', to: 'capability:roadmap', type: 'OWNS', description: 'Product owns roadmap and prioritization.' },
    { from: 'capability:campaign-planning', to: 'entity:offer', type: 'USES', description: 'Campaigns package products into offers.' },
    { from: 'capability:campaign-planning', to: 'entity:persona', type: 'TARGETS', description: 'Campaigns target personas and segments.' },
    { from: 'capability:crm-leads', to: 'process:customer-journey', type: 'TRACKS', description: 'CRM tracks customer journey stages.' },
    { from: 'capability:paid-media', to: 'metric:cac', type: 'MEASURES', description: 'Paid media monitors acquisition cost.' },
    { from: 'process:customer-journey', to: 'metric:conversion-rate', type: 'MEASURES', description: 'Journey health is measured by conversion rates.' },
    { from: 'capability:analytics', to: 'metric:conversion-rate', type: 'REPORTS', description: 'Analytics reports funnel conversion.' },
    { from: 'capability:analytics', to: 'metric:cac', type: 'REPORTS', description: 'Analytics reports acquisition economics.' },
    { from: 'capability:integration-architecture', to: 'system:source-of-truth', type: 'MAPS', description: 'Integrations depend on clear sources of truth.' },
    { from: 'capability:data-governance', to: 'system:source-of-truth', type: 'GOVERNS', description: 'Governance documents source-of-truth ownership.' },
    { from: 'capability:product-catalog', to: 'entity:offer', type: 'SUPPORTS', description: 'Product catalog supports commercial offers.' },
    { from: 'capability:roadmap', to: 'capability:integration-architecture', type: 'DEPENDS_ON', description: 'Roadmap initiatives often depend on integrations.' }
  ]
};

export function normalizeTenantId(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, TENANT_MAX_LENGTH);

  return normalized || 'public';
}

export function normalizeUserId(value: string | null | undefined): string | undefined {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, USER_MAX_LENGTH);

  return normalized || undefined;
}

export function tenantDatabaseName(tenantId: string): string {
  return `nexus_tenant_${normalizeTenantId(tenantId)}`;
}

export function resolveGraphContext(input: {
  tenantId?: string | null;
  userId?: string | null;
  database?: string | null;
  databaseStrategy?: GraphDatabaseStrategy | null;
} = {}): GraphContext {
  const tenantId = normalizeTenantId(input.tenantId ?? process.env.NEXUS_TENANT_ID);
  const userId = normalizeUserId(input.userId ?? process.env.NEXUS_USER_ID);
  const databaseStrategy = input.databaseStrategy
    ?? (process.env.NEXUS_GRAPH_DATABASE_STRATEGY === 'database-per-tenant' ? 'database-per-tenant' : 'shared');
  const database = input.database
    || process.env.NEXUS_GRAPH_DATABASE
    || (databaseStrategy === 'database-per-tenant' ? tenantDatabaseName(tenantId) : 'neo4j');

  return { tenantId, userId, database, databaseStrategy };
}

export function buildBootstrapPlan(context: GraphContext, seed: WhiteLabelSeed = DEFAULT_WHITE_LABEL_SEED): BootstrapPlan {
  return {
    constraints: [
      'CREATE CONSTRAINT nexus_graph_node_key IF NOT EXISTS FOR (n:NexusGraphNode) REQUIRE (n.tenant_id, n.id) IS UNIQUE',
      'CREATE INDEX nexus_graph_node_label IF NOT EXISTS FOR (n:NexusGraphNode) ON (n.tenant_id, n.label)',
      'CREATE INDEX nexus_graph_node_kind IF NOT EXISTS FOR (n:NexusGraphNode) ON (n.tenant_id, n.kind)'
    ],
    seedNodes: seed.nodes.map(node => ({
      cypher: [
        'MERGE (n:NexusGraphNode {tenant_id: $tenant_id, id: $id})',
        'SET n.kind = $kind,',
        '    n.label = $label,',
        '    n.description = $description,',
        '    n.aliases = $aliases,',
        '    n.seed_version = $seed_version,',
        '    n.updated_at = datetime()'
      ].join('\n'),
      params: {
        tenant_id: context.tenantId,
        seed_version: seed.version,
        ...node,
        aliases: node.aliases ?? []
      }
    })),
    seedRelations: seed.relations.map(relation => ({
      cypher: [
        'MATCH (from:NexusGraphNode {tenant_id: $tenant_id, id: $from_id})',
        'MATCH (to:NexusGraphNode {tenant_id: $tenant_id, id: $to_id})',
        'MERGE (from)-[r:NEXUS_RELATES {tenant_id: $tenant_id, type: $type}]->(to)',
        'SET r.description = $description,',
        '    r.seed_version = $seed_version,',
        '    r.updated_at = datetime()'
      ].join('\n'),
      params: {
        tenant_id: context.tenantId,
        seed_version: seed.version,
        from_id: relation.from,
        to_id: relation.to,
        type: relation.type,
        description: relation.description
      }
    }))
  };
}

export function assertReadOnlyCypher(cypher: string): void {
  const trimmed = cypher.trim();
  if (!trimmed) {
    throw new Error('Cypher query is required.');
  }
  if (trimmed.includes(';')) {
    throw new Error('Only one read-only Cypher statement is allowed.');
  }

  const banned = /\b(CREATE|MERGE|SET|DELETE|DETACH|REMOVE|DROP|ALTER|LOAD\s+CSV|GRANT|DENY|REVOKE|START|STOP)\b/i;
  const bannedCall = /\bCALL\s+(dbms|apoc)\b/i;
  if (banned.test(trimmed) || bannedCall.test(trimmed)) {
    throw new Error('Only read-only Cypher is allowed.');
  }

  const allowedStart = /^(MATCH|WITH|RETURN|CALL\s+db\.)\b/i;
  if (!allowedStart.test(trimmed)) {
    throw new Error('Read-only Cypher must start with MATCH, WITH, RETURN, or CALL db.*.');
  }
}

export function assertTenantScopedReadOnlyCypher(cypher: string): void {
  assertReadOnlyCypher(cypher);
  if (!/\btenant_id\b/i.test(cypher)) {
    throw new Error('Read-only Cypher must explicitly filter by tenant_id.');
  }
}
