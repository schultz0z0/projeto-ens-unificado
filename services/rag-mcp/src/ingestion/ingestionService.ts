import { createEmbeddingProviderFromEnv, type EmbeddingProvider } from './embeddings/embeddingProvider.js';
import { getIngestionSource } from './sourceRegistry.js';
import type { IngestionDocument, IngestionRefreshResult } from './types.js';
import { splitTextForEmbedding } from './text.js';
import type { RagRepository } from '../rag/types.js';

export class IngestionService {
  constructor(
    private readonly repository: RagRepository,
    private readonly embeddingProvider: EmbeddingProvider = createEmbeddingProviderFromEnv()
  ) {}

  async refreshSource(input: { sourceId: string; tenantSlug: string }): Promise<IngestionRefreshResult> {
    const source = getIngestionSource(input.sourceId);
    const sourceResult = await source.load(input.tenantSlug);
    const documents = splitLargeDocumentChunks(sourceResult.documents);
    const chunks = documents.flatMap(document => document.chunks);
    const embeddings = await this.embeddingProvider.embed(chunks.map(chunk => chunk.content));
    const embeddedChunkCount = embeddings.filter(Boolean).length;

    await this.repository.refreshSourceDocuments({
      tenantSlug: input.tenantSlug,
      sourceId: input.sourceId,
      documents,
      embeddings,
      embeddingModel: this.embeddingProvider.model
    });

    await this.repository.recordAuditEvent({
      actorProfile: 'mcp-ingestion',
      action: `ingest:${input.sourceId}`,
      tenant: input.tenantSlug,
      allowed: true,
      reason: `Refreshed ${sourceResult.documents.length} documents and ${chunks.length} chunks.`
    });

    return {
      sourceId: input.sourceId,
      tenantSlug: input.tenantSlug,
      fetchedCount: sourceResult.fetchedCount,
      skippedCount: sourceResult.skippedCount,
      documentCount: documents.length,
      chunkCount: chunks.length,
      embeddedChunkCount,
      embeddingModel: this.embeddingProvider.model,
      warnings: [
        ...sourceResult.warnings,
        ...(embeddedChunkCount === 0 ? ['Embeddings skipped because no embedding provider is configured.'] : [])
      ]
    };
  }
}

function splitLargeDocumentChunks(documents: IngestionDocument[]): IngestionDocument[] {
  return documents.map(document => ({
    ...document,
    chunks: document.chunks.flatMap(chunk => {
      const parts = splitTextForEmbedding(chunk.content);
      if (parts.length <= 1) {
        return chunk;
      }

      return parts.map((part, index) => ({
        ...chunk,
        kind: `${chunk.kind}_part_${index + 1}`,
        content: part,
        metadata: {
          ...chunk.metadata,
          split_from_kind: chunk.kind,
          split_part: index + 1,
          split_total: parts.length
        }
      }));
    })
  }));
}
