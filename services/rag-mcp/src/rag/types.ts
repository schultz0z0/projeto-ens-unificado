import type { IngestionDocument } from '../ingestion/types.js';

export type EnsRagCollection = 'courses' | 'insights' | 'institutional' | 'marketing';

export type RagSearchIntent =
  | 'course_fact'
  | 'course_copy'
  | 'analytics'
  | 'institutional'
  | 'marketing_strategy'
  | 'general';

export type RagSearchInput = {
  query: string;
  allowedTenants: string[];
  collections?: EnsRagCollection[];
  limit: number;
  queryEmbedding?: number[];
  freshnessDays?: number;
  includeStale?: boolean;
  intent?: RagSearchIntent;
  courseFilters?: RagCourseSearchFilters;
};

export type RagCourseSearchFilters = {
  chunkKinds?: string[];
  courseCategories?: string[];
  courseTypes?: string[];
  courseStatuses?: string[];
  offerStatuses?: string[];
  modalities?: string[];
  localities?: string[];
  onlyActiveOffers?: boolean;
  offerStartFrom?: string;
  offerStartTo?: string;
  enrollmentOpenAt?: string;
};

export type RagSearchResult = {
  chunkId: string;
  documentId: string;
  tenant: string;
  collection: EnsRagCollection;
  title: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  sourceUri?: string;
};

export type RagSource = {
  id: string;
  tenant: string;
  collection: EnsRagCollection;
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
  listCollections(): Promise<
    Array<{
      collection: EnsRagCollection;
      documentCount: number;
      latestUpdatedAt?: string;
    }>
  >;
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
  insertKnowledgeDocument(input: {
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
  }): Promise<RagDocument>;
}
