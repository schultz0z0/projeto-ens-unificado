import type { EnsRagCollection, RagSource } from './types.js';

export type GraphSyncSourcesPayload = {
  tenant: string;
  collections: EnsRagCollection[];
  count: number;
  sources: RagSource[];
};

const SAFE_METADATA_KEYS = new Set([
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

export function buildGraphSyncSourcesPayload(input: {
  tenant: string;
  collections?: EnsRagCollection[];
  limit?: number;
  sources: RagSource[];
}): GraphSyncSourcesPayload {
  const tenant = input.tenant || 'ens';
  const collections: EnsRagCollection[] = input.collections?.length
    ? input.collections
    : ['courses', 'marketing', 'insights', 'institutional'];
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  const collectionSet = new Set(collections);
  const sources = input.sources
    .filter(source => source.tenant === tenant && collectionSet.has(source.collection))
    .slice(0, limit)
    .map(source => ({
      id: source.id,
      tenant: source.tenant,
      collection: source.collection,
      title: source.title,
      sourceType: source.sourceType,
      sourceUri: source.sourceUri,
      visibility: source.visibility,
      updatedAt: source.updatedAt,
      metadata: sanitizeMetadata(source.metadata)
    }));

  return {
    tenant,
    collections,
    count: sources.length,
    sources
  };
}

export function parseGraphSyncCollections(value: unknown): EnsRagCollection[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const collections = raw
    .map(item => String(item).trim())
    .filter((item): item is EnsRagCollection => (
      item === 'courses' || item === 'marketing' || item === 'insights' || item === 'institutional'
    ));
  return collections.length ? [...new Set(collections)] : undefined;
}

function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, string | number | boolean | string[]> {
  const sanitized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
