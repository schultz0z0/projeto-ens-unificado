import { describe, expect, test } from 'vitest';
import { buildGraphSyncSourcesPayload } from './graphSync.js';
import type { RagSource } from './types.js';

describe('RAG graph sync payload', () => {
  test('exports only lightweight source references for the requested tenant and collections', () => {
    const payload = buildGraphSyncSourcesPayload({
      tenant: 'ens',
      collections: ['courses', 'insights'],
      limit: 2,
      sources: [
        source('ens', 'courses', 'Curso A', { content: 'nao exportar', source_key: 'curso-a' }),
        source('ens', 'marketing', 'Marketing A'),
        source('ens', 'insights', 'Insight A'),
        source('acme', 'courses', 'Curso de outro tenant')
      ]
    });

    expect(payload).toMatchObject({
      tenant: 'ens',
      count: 2,
      collections: ['courses', 'insights']
    });
    expect(payload.sources.map(source => source.title)).toEqual(['Curso A', 'Insight A']);
    expect(JSON.stringify(payload)).not.toContain('nao exportar');
    expect(payload.sources[0].metadata).toEqual({ source_key: 'curso-a' });
  });
});

function source(
  tenant: string,
  collection: RagSource['collection'],
  title: string,
  metadata: Record<string, unknown> = {}
): RagSource {
  return {
    id: `${tenant}-${collection}-${title}`,
    tenant,
    collection,
    title,
    sourceType: `ens_${collection}`,
    sourceUri: `https://example.test/${collection}/${title}`,
    visibility: 'internal',
    metadata,
    updatedAt: '2026-06-30T12:00:00.000Z'
  };
}
