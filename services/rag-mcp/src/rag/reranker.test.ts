import { describe, expect, it } from 'vitest';
import { LocalRagReranker } from './reranker.js';
import type { RagSearchResult } from './types.js';

const baseResult: RagSearchResult = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  tenant: 'ens',
  collection: 'courses',
  title: 'Curso ENS Exemplo',
  content: 'Curso ENS: Curso ENS Exemplo',
  score: 0.2,
  metadata: {},
  sourceUri: 'https://example.com'
};

describe('LocalRagReranker', () => {
  it('boosts active ENS course offers above generic course chunks for offer queries', async () => {
    const reranker = new LocalRagReranker();
    const results = await reranker.rerank({
      query: 'qual oferta disponivel com link de inscricao do Curso ENS Exemplo',
      intent: 'course_fact',
      requestedLimit: 3,
      results: [
        {
          ...baseResult,
          chunkId: 'summary',
          content: 'Resumo generico do curso.',
          metadata: { chunk_kind: 'course_summary', course_name: 'Curso ENS Exemplo' }
        },
        {
          ...baseResult,
          chunkId: 'blocked-offer',
          score: 0.25,
          content: 'Oferta 100. Status blocked.',
          metadata: {
            chunk_kind: 'course_offer',
            course_name: 'Curso ENS Exemplo',
            offer_status: 'blocked',
            offer_hidden: false
          }
        },
        {
          ...baseResult,
          chunkId: 'active-offer',
          score: 0.18,
          content: 'Oferta 99. Status available. Link de inscricao.',
          metadata: {
            chunk_kind: 'course_offer',
            course_name: 'Curso ENS Exemplo',
            offer_status: 'available',
            offer_hidden: false
          }
        }
      ]
    });

    expect(results.mode).toBe('local');
    expect(results.results.map(result => result.chunkId)).toEqual(['active-offer', 'blocked-offer', 'summary']);
    expect(results.results[0].metadata.reranker_reason).toContain('active_offer');
  });

  it('keeps non-course collections eligible while still returning the requested limit', async () => {
    const reranker = new LocalRagReranker();
    const results = await reranker.rerank({
      query: 'tom de voz ENS para WhatsApp',
      intent: 'marketing_strategy',
      requestedLimit: 1,
      results: [
        {
          ...baseResult,
          chunkId: 'marketing',
          collection: 'marketing',
          title: 'Tom de voz ENS',
          content: 'WhatsApp deve ser claro e humano.',
          score: 0.3,
          metadata: { chunk_kind: 'marketing_memory' }
        },
        {
          ...baseResult,
          chunkId: 'course',
          content: 'Curso ENS generico.',
          score: 0.29,
          metadata: { chunk_kind: 'course_summary' }
        }
      ]
    });

    expect(results.results).toHaveLength(1);
    expect(results.results[0].chunkId).toBe('marketing');
  });
});
