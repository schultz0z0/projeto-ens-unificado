import type { IngestionDocument } from '../ingestion/types.js';

export type RagSearchInput = {
  query: string;
  allowedTenants: string[];
  limit: number;
  queryEmbedding?: number[];
};

export type RagSearchResult = {
  chunkId: string;
  documentId: string;
  tenant: string;
  title: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  sourceUri?: string;
};

export type RagSource = {
  id: string;
  tenant: string;
  title: string;
  sourceType: string;
  sourceUri?: string;
  visibility: string;
  metadata: Record<string, unknown>;
  updatedAt?: string;
};

export type RagDocument = RagSource & {
  chunks: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    createdAt?: string;
  }>;
};

export type RagAuditEvent = {
  id: string;
  actorProfile: string;
  action: string;
  tenant?: string;
  documentId?: string;
  allowed: boolean;
  reason?: string;
  createdAt: string;
};

export interface RagRepository {
  searchChunks(input: RagSearchInput): Promise<RagSearchResult[]>;
  listSources(tenant: string): Promise<RagSource[]>;
  getDocument(documentId: string): Promise<RagDocument | null>;
  findDocumentsByTitle(input: {
    tenantSlug: string;
    sourceId: string;
    title: string;
    limit: number;
  }): Promise<RagSource[]>;
  auditRecent(limit: number): Promise<RagAuditEvent[]>;
  recordQuery(input: {
    actorProfile: string;
    activeClient?: string;
    allowedTenants: string[];
    query: string;
    purpose?: string;
    resultCount: number;
  }): Promise<void>;
  recordAuditEvent(input: {
    actorProfile: string;
    action: string;
    tenant?: string;
    documentId?: string;
    allowed: boolean;
    reason?: string;
  }): Promise<void>;
  refreshSourceDocuments(input: {
    tenantSlug: string;
    sourceId: string;
    documents: IngestionDocument[];
    embeddings: Array<number[] | null>;
    embeddingModel?: string;
  }): Promise<void>;
}
