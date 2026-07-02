import type { RelateInput, UpsertFactInput } from './repository.js';

export type RagGraphSyncCollection = 'courses' | 'marketing' | 'insights' | 'institutional';

export type RagGraphSyncSource = {
  id: string;
  tenant: string;
  collection: RagGraphSyncCollection;
  title: string;
  sourceType: string;
  sourceUri?: string;
  visibility: string;
  metadata: Record<string, unknown>;
  updatedAt?: string;
};

export type RagGraphSyncPlan = {
  tenant_id: string;
  source_count: number;
  facts: UpsertFactInput[];
  relations: RelateInput[];
};

const COLLECTION_MAPPING: Record<RagGraphSyncCollection, {
  kind: UpsertFactInput['kind'];
  anchorId: string;
  descriptionPrefix: string;
}> = {
  courses: {
    kind: 'course_ref',
    anchorId: 'capability:product-catalog',
    descriptionPrefix: 'Referencia leve do catalogo de cursos ENS no RAG'
  },
  marketing: {
    kind: 'marketing_ref',
    anchorId: 'domain:marketing',
    descriptionPrefix: 'Referencia leve de memoria de marketing ENS no RAG'
  },
  insights: {
    kind: 'insight_ref',
    anchorId: 'capability:analytics',
    descriptionPrefix: 'Referencia leve de insight analitico ENS no RAG'
  },
  institutional: {
    kind: 'institutional_ref',
    anchorId: 'system:source-of-truth',
    descriptionPrefix: 'Referencia leve de conhecimento institucional ENS no RAG'
  }
};

const SAFE_SOURCE_METADATA_KEYS = new Set([
  'source_key',
  'id_academico',
  'course_category',
  'course_type',
  'course_status',
  'offer_status',
  'offer_modality',
  'offer_location',
  'related_course',
  'campaign_name',
  'category',
  'subject',
  'analysis_date',
  'confidence',
  'stale_after_days'
]);

export function buildRagGraphSyncPlan(input: {
  tenantId: string;
  sources: RagGraphSyncSource[];
}): RagGraphSyncPlan {
  const facts = input.sources.map(source => {
    const mapping = COLLECTION_MAPPING[source.collection];
    return {
      id: ragNodeId(source),
      kind: mapping.kind,
      label: source.title,
      description: `${mapping.descriptionPrefix}: ${source.title}`,
      aliases: buildAliases(source),
      source: `ens_rag:${source.collection}`,
      properties: {
        source_collection: source.collection,
        source_document_id: source.id,
        source_uri: source.sourceUri ?? '',
        source_type: source.sourceType,
        source_visibility: source.visibility,
        last_verified_at: source.updatedAt ?? '',
        confidence: 'source_backed',
        ...sanitizeSourceMetadata(source.metadata)
      }
    };
  });

  const relations = input.sources.map(source => ({
    fromId: COLLECTION_MAPPING[source.collection].anchorId,
    toId: ragNodeId(source),
    type: 'REFERENCES_RAG',
    description: `Graph reference points to ENS RAG ${source.collection} source ${source.id}.`,
    properties: {
      source_collection: source.collection,
      source_document_id: source.id,
      last_verified_at: source.updatedAt ?? ''
    }
  }));

  return {
    tenant_id: input.tenantId,
    source_count: input.sources.length,
    facts,
    relations
  };
}

export async function fetchRagGraphSyncSources(input: {
  ragInternalUrl: string;
  tenantId: string;
  collections?: RagGraphSyncCollection[];
  limit?: number;
  internalKey?: string;
}): Promise<RagGraphSyncSource[]> {
  const url = resolveRagGraphSyncUrl(input.ragInternalUrl);
  url.searchParams.set('tenant', input.tenantId);
  if (input.collections?.length) url.searchParams.set('collections', input.collections.join(','));
  if (input.limit) url.searchParams.set('limit', String(input.limit));

  const response = await fetch(url, {
    headers: input.internalKey ? { 'X-Nexus-Internal-Key': input.internalKey } : {}
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`RAG graph sync source fetch failed: ${payload?.error ?? response.status}`);
  }
  if (!Array.isArray(payload.sources)) {
    throw new Error('RAG graph sync source fetch failed: invalid sources payload.');
  }
  return payload.sources;
}

function ragNodeId(source: RagGraphSyncSource): string {
  return `rag:${source.collection}:${source.id}`;
}

function buildAliases(source: RagGraphSyncSource): string[] {
  const aliases = [source.title];
  const sourceKey = source.metadata?.source_key;
  if (typeof sourceKey === 'string' && sourceKey.trim()) aliases.push(sourceKey.trim());
  return [...new Set(aliases)];
}

function sanitizeSourceMetadata(metadata: Record<string, unknown> = {}): Record<string, string | number | boolean | string[]> {
  const sanitized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_SOURCE_METADATA_KEYS.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[`rag_${key}`] = value;
    } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      sanitized[`rag_${key}`] = value;
    }
  }
  return sanitized;
}

function resolveRagGraphSyncUrl(value: string): URL {
  const url = new URL(value || 'http://rag-mcp:8000/internal/graph-sync/sources');
  if (url.pathname === '/' || url.pathname.endsWith('/mcp')) {
    url.pathname = '/internal/graph-sync/sources';
  }
  return url;
}
