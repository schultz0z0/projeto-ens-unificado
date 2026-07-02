import { describe, expect, test } from 'vitest';
import { buildRagGraphSyncPlan } from './ragSync.js';

describe('RAG to Graph sync plan', () => {
  test('creates lightweight graph references without copying RAG body content', () => {
    const plan = buildRagGraphSyncPlan({
      tenantId: 'ens',
      sources: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          tenant: 'ens',
          collection: 'courses',
          title: 'Curso Tecnico em Seguros',
          sourceType: 'ens_course',
          sourceUri: 'https://ens.edu.br/curso/tecnico',
          visibility: 'public',
          updatedAt: '2026-06-30T12:00:00.000Z',
          metadata: {
            course_category: 'tecnico',
            course_type: 'curso',
            content: 'texto longo que nao deve ir para o graph'
          }
        }
      ]
    });

    expect(plan.facts).toHaveLength(1);
    expect(plan.facts[0]).toMatchObject({
      id: 'rag:courses:11111111-1111-1111-1111-111111111111',
      kind: 'course_ref',
      label: 'Curso Tecnico em Seguros',
      source: 'ens_rag:courses'
    });
    expect(plan.facts[0].description).not.toContain('texto longo');
    expect(plan.facts[0].properties).toMatchObject({
      source_collection: 'courses',
      source_document_id: '11111111-1111-1111-1111-111111111111',
      source_uri: 'https://ens.edu.br/curso/tecnico',
      last_verified_at: '2026-06-30T12:00:00.000Z'
    });
    expect(JSON.stringify(plan.facts[0].properties)).not.toContain('texto longo');
    expect(plan.relations).toContainEqual(expect.objectContaining({
      fromId: 'capability:product-catalog',
      toId: 'rag:courses:11111111-1111-1111-1111-111111111111',
      type: 'REFERENCES_RAG'
    }));
  });

  test('maps RAG collections to graph reference kinds and owner anchors', () => {
    const plan = buildRagGraphSyncPlan({
      tenantId: 'ens',
      sources: [
        source('courses', 'Curso A'),
        source('marketing', 'Memoria de Marketing'),
        source('insights', 'Insight de Funil'),
        source('institutional', 'Manual Institucional')
      ]
    });

    expect(plan.facts.map(fact => fact.kind)).toEqual([
      'course_ref',
      'marketing_ref',
      'insight_ref',
      'institutional_ref'
    ]);
    expect(plan.relations.map(relation => relation.fromId)).toEqual([
      'capability:product-catalog',
      'domain:marketing',
      'capability:analytics',
      'system:source-of-truth'
    ]);
  });
});

function source(collection: 'courses' | 'marketing' | 'insights' | 'institutional', title: string) {
  return {
    id: `${collection}-doc`,
    tenant: 'ens',
    collection,
    title,
    sourceType: `ens_${collection}`,
    visibility: 'internal',
    metadata: {},
    updatedAt: '2026-06-30T12:00:00.000Z'
  };
}
