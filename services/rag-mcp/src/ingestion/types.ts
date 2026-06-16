export type IngestionChunk = {
  kind: string;
  content: string;
  metadata: Record<string, unknown>;
};

export type IngestionDocument = {
  tenantSlug: string;
  sourceId: string;
  sourceKey: string;
  title: string;
  sourceType: string;
  sourceUri?: string;
  visibility: string;
  metadata: Record<string, unknown>;
  chunks: IngestionChunk[];
};

export type IngestionSourceResult = {
  sourceId: string;
  tenantSlug: string;
  fetchedCount: number;
  skippedCount: number;
  documents: IngestionDocument[];
  warnings: string[];
};

export type IngestionSource = {
  sourceId: string;
  load(tenantSlug: string): Promise<IngestionSourceResult>;
};

export type IngestionRefreshResult = {
  sourceId: string;
  tenantSlug: string;
  fetchedCount: number;
  skippedCount: number;
  documentCount: number;
  chunkCount: number;
  embeddedChunkCount: number;
  embeddingModel?: string;
  warnings: string[];
};

