import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EnsRagCollection,
  RagAuditEvent,
  RagDocument,
  RagRepository,
  RagSearchInput,
  RagSearchResult,
  RagSource
} from './types.js';
import type { IngestionDocument } from '../ingestion/types.js';

export class RepositoryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryUnavailableError';
  }
}

export function createSupabaseRepository(options: {
  url?: string;
  serviceRoleKey?: string;
}): RagRepository {
  if (!options.url || !options.serviceRoleKey) {
    return new UnavailableRagRepository('Supabase env vars are not configured.');
  }

  return new SupabaseRagRepository(createClient(options.url, options.serviceRoleKey));
}

class UnavailableRagRepository implements RagRepository {
  constructor(private readonly reason: string) {}

  async searchChunks(): Promise<RagSearchResult[]> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async listSources(): Promise<RagSource[]> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async listCollections(): Promise<Array<{ collection: EnsRagCollection; documentCount: number; latestUpdatedAt?: string }>> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async getDocument(): Promise<RagDocument | null> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async findDocumentsByTitle(): Promise<RagSource[]> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async auditRecent(): Promise<RagAuditEvent[]> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async recordQuery(): Promise<void> {}

  async recordAuditEvent(): Promise<void> {}

  async refreshSourceDocuments(): Promise<void> {
    throw new RepositoryUnavailableError(this.reason);
  }

  async insertKnowledgeDocument(): Promise<RagDocument> {
    throw new RepositoryUnavailableError(this.reason);
  }
}

class SupabaseRagRepository implements RagRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async searchChunks(input: RagSearchInput): Promise<RagSearchResult[]> {
    const { data, error } = await this.supabase.rpc('match_document_chunks', {
      query_text: input.query,
      tenant_slugs: input.allowedTenants,
      match_count: input.limit,
      query_embedding: input.queryEmbedding ?? null,
      collections: input.collections ?? null,
      freshness_cutoff: toFreshnessCutoff(input.freshnessDays),
      include_stale: input.includeStale ?? true
    });

    if (error) {
      throw new Error(`Supabase search failed: ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      tenant: row.tenant_slug,
      collection: row.collection,
      title: row.title,
      content: row.content,
      score: Number(row.score ?? 0),
      metadata: row.metadata ?? {},
      sourceUri: row.source_uri ?? undefined
    }));
  }

  async listSources(tenant: string): Promise<RagSource[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('id,title,collection,source_type,source_uri,visibility,metadata,updated_at,tenants!inner(slug)')
      .eq('tenants.slug', tenant)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase list sources failed: ${error.message}`);
    }

    return (data ?? []).map((row: any) => mapSource(row));
  }

  async listCollections(): Promise<Array<{ collection: EnsRagCollection; documentCount: number; latestUpdatedAt?: string }>> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('collection,updated_at,tenants!inner(slug)')
      .eq('tenants.slug', 'ens');

    if (error) {
      throw new Error(`Supabase list collections failed: ${error.message}`);
    }

    const grouped = new Map<EnsRagCollection, { collection: EnsRagCollection; documentCount: number; latestUpdatedAt?: string }>();

    for (const row of data ?? []) {
      const collection = row.collection as EnsRagCollection;
      const current = grouped.get(collection);
      if (!current) {
        grouped.set(collection, {
          collection,
          documentCount: 1,
          latestUpdatedAt: row.updated_at ?? undefined
        });
        continue;
      }

      current.documentCount += 1;
      if (!current.latestUpdatedAt || (row.updated_at && row.updated_at > current.latestUpdatedAt)) {
        current.latestUpdatedAt = row.updated_at ?? current.latestUpdatedAt;
      }
    }

    return [...grouped.values()].sort((a, b) => a.collection.localeCompare(b.collection));
  }

  async getDocument(documentId: string): Promise<RagDocument | null> {
    const { data: document, error: documentError } = await this.supabase
      .from('documents')
      .select('id,title,collection,source_type,source_uri,visibility,metadata,updated_at,tenants!inner(slug)')
      .eq('id', documentId)
      .maybeSingle();

    if (documentError) {
      throw new Error(`Supabase get document failed: ${documentError.message}`);
    }

    if (!document) {
      return null;
    }

    const { data: chunks, error: chunksError } = await this.supabase
      .from('document_chunks')
      .select('id,content,metadata,created_at,collection')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (chunksError) {
      throw new Error(`Supabase get document chunks failed: ${chunksError.message}`);
    }

    return {
      ...mapSource(document),
      chunks: (chunks ?? []).map((chunk: any) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata ?? {},
        createdAt: chunk.created_at ?? undefined
      }))
    };
  }

  async findDocumentsByTitle(input: {
    tenantSlug: string;
    sourceId: string;
    title: string;
    limit: number;
  }): Promise<RagSource[]> {
    const normalizedTitle = input.title.trim();
    const { data, error } = await this.supabase
      .from('documents')
      .select('id,title,collection,source_type,source_uri,visibility,metadata,updated_at,tenants!inner(slug)')
      .eq('tenants.slug', input.tenantSlug)
      .eq('source_id', input.sourceId)
      .ilike('title', `%${escapeIlike(normalizedTitle)}%`)
      .limit(input.limit);

    if (error) {
      throw new Error(`Supabase find documents by title failed: ${error.message}`);
    }

    return (data ?? []).map((row: any) => mapSource(row)).sort((a, b) => {
      const aScore = titleMatchScore(a.title, normalizedTitle);
      const bScore = titleMatchScore(b.title, normalizedTitle);
      return bScore - aScore;
    });
  }

  async auditRecent(limit: number): Promise<RagAuditEvent[]> {
    const { data, error } = await this.supabase
      .from('rag_audit_events')
      .select('id,actor_profile,action,tenant_id,document_id,allowed,reason,created_at,tenants(slug)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Supabase audit query failed: ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      actorProfile: row.actor_profile,
      action: row.action,
      tenant: row.tenants?.slug ?? undefined,
      documentId: row.document_id ?? undefined,
      allowed: row.allowed,
      reason: row.reason ?? undefined,
      createdAt: row.created_at
    }));
  }

  async recordQuery(input: {
    actorProfile: string;
    activeClient?: string;
    allowedTenants: string[];
    query: string;
    purpose?: string;
    resultCount: number;
  }): Promise<void> {
    await this.supabase.from('rag_queries').insert({
      actor_profile: input.actorProfile,
      active_client: input.activeClient ?? null,
      allowed_tenants: input.allowedTenants,
      query: input.query,
      purpose: input.purpose ?? null,
      result_count: input.resultCount
    });
  }

  async recordAuditEvent(input: {
    actorProfile: string;
    action: string;
    tenant?: string;
    documentId?: string;
    allowed: boolean;
    reason?: string;
  }): Promise<void> {
    let tenantId: string | null = null;

    if (input.tenant) {
      const { data } = await this.supabase.from('tenants').select('id').eq('slug', input.tenant).maybeSingle();
      tenantId = data?.id ?? null;
    }

    await this.supabase.from('rag_audit_events').insert({
      actor_profile: input.actorProfile,
      action: input.action,
      tenant_id: tenantId,
      document_id: input.documentId ?? null,
      allowed: input.allowed,
      reason: input.reason ?? null
    });
  }

  async refreshSourceDocuments(input: {
    tenantSlug: string;
    sourceId: string;
    documents: IngestionDocument[];
    embeddings: Array<number[] | null>;
    embeddingModel?: string;
  }): Promise<void> {
    const tenantId = await this.ensureTenant(input.tenantSlug);

    const { error: deleteError } = await this.supabase
      .from('documents')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('source_id', input.sourceId);

    if (deleteError) {
      throw new Error(`Supabase refresh delete failed: ${deleteError.message}`);
    }

    let embeddingOffset = 0;
    for (const document of input.documents) {
      const { data: insertedDocument, error: documentError } = await this.supabase
        .from('documents')
        .insert({
          tenant_id: tenantId,
          collection: document.collection,
          title: document.title,
          source_type: document.sourceType,
          source_id: document.sourceId,
          source_key: document.sourceKey,
          source_uri: document.sourceUri ?? null,
          visibility: document.visibility,
          metadata: document.metadata
        })
        .select('id')
        .single();

      if (documentError) {
        throw new Error(`Supabase document insert failed: ${documentError.message}`);
      }

      const chunkRows = document.chunks.map((chunk, index) => {
        const embedding = input.embeddings[embeddingOffset + index] ?? null;
        return {
          tenant_id: tenantId,
          document_id: insertedDocument.id,
          collection: document.collection,
          content: chunk.content,
          embedding,
          embedding_model: embedding ? input.embeddingModel ?? null : null,
          metadata: {
            ...chunk.metadata,
            source_id: document.sourceId,
            source_key: document.sourceKey,
            chunk_kind: chunk.kind
          }
        };
      });

      embeddingOffset += document.chunks.length;

      if (chunkRows.length > 0) {
        const { error: chunkError } = await this.supabase.from('document_chunks').insert(chunkRows);
        if (chunkError) {
          throw new Error(`Supabase chunk insert failed: ${chunkError.message}`);
        }
      }
    }
  }

  async insertKnowledgeDocument(input: {
    collection: EnsRagCollection;
    title: string;
    sourceId: string;
    sourceKey: string;
    sourceType: string;
    sourceUri?: string;
    visibility: string;
    metadata: Record<string, unknown>;
    chunks: Array<{
      kind: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding?: number[] | null;
      embeddingModel?: string;
    }>;
  }): Promise<RagDocument> {
    const tenantId = await this.ensureTenant('ens');
    const { data: insertedDocument, error: documentError } = await this.supabase
      .from('documents')
      .insert({
        tenant_id: tenantId,
        collection: input.collection,
        title: input.title,
        source_type: input.sourceType,
        source_id: input.sourceId,
        source_key: input.sourceKey,
        source_uri: input.sourceUri ?? null,
        visibility: input.visibility,
        metadata: input.metadata
      })
      .select('id,title,collection,source_type,source_uri,visibility,metadata,updated_at,tenants!inner(slug)')
      .single();

    if (documentError) {
      throw new Error(`Supabase document insert failed: ${documentError.message}`);
    }

    const chunkRows = input.chunks.map(chunk => ({
      tenant_id: tenantId,
      document_id: insertedDocument.id,
      collection: input.collection,
      content: chunk.content,
      embedding: chunk.embedding ?? null,
      embedding_model: chunk.embedding ? chunk.embeddingModel ?? null : null,
      metadata: {
        ...chunk.metadata,
        source_id: input.sourceId,
        source_key: input.sourceKey,
        chunk_kind: chunk.kind
      }
    }));

    if (chunkRows.length > 0) {
      const { error: chunkError } = await this.supabase.from('document_chunks').insert(chunkRows);
      if (chunkError) {
        throw new Error(`Supabase chunk insert failed: ${chunkError.message}`);
      }
    }

    return {
      ...mapSource(insertedDocument),
      chunks: chunkRows.map((row, index) => ({
        id: `inserted-${index}`,
        content: row.content,
        metadata: row.metadata
      }))
    };
  }

  private async ensureTenant(slug: string): Promise<string> {
    const { data: existing, error: lookupError } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Supabase tenant lookup failed: ${lookupError.message}`);
    }

    if (existing?.id) {
      return existing.id;
    }

    const { data: inserted, error: insertError } = await this.supabase
      .from('tenants')
      .insert({
        slug,
        name: slug === 'ens' ? 'ENS' : slug,
        type: slug === 'ens' ? 'client' : 'external'
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Supabase tenant insert failed: ${insertError.message}`);
    }

    return inserted.id;
  }
}

function mapSource(row: any): RagSource {
  return {
    id: row.id,
    tenant: row.tenants?.slug,
    collection: row.collection,
    title: row.title,
    sourceType: row.source_type,
    sourceUri: row.source_uri ?? undefined,
    visibility: row.visibility,
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at ?? undefined
  };
}

function toFreshnessCutoff(freshnessDays?: number): string | null {
  if (!freshnessDays || freshnessDays <= 0) {
    return null;
  }

  const now = Date.now();
  return new Date(now - freshnessDays * 24 * 60 * 60 * 1000).toISOString();
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, match => `\\${match}`);
}

function titleMatchScore(title: string, query: string): number {
  const normalizedTitle = normalizeTitle(title);
  const normalizedQuery = normalizeTitle(query);
  if (normalizedTitle === normalizedQuery) {
    return 3;
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    return 2;
  }
  return 1;
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
