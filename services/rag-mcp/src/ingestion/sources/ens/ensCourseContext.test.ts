import { describe, expect, it } from 'vitest';
import { buildEnsCourseContext } from './ensCourseContext.js';
import type { RagDocument } from '../../../rag/types.js';

const document: RagDocument = {
  id: 'doc-1',
  tenant: 'ens',
  title: 'Gestão de Seguros',
  sourceType: 'ens_api_course',
  sourceUri: 'https://example.com/inscricao',
  visibility: 'client',
  metadata: {
    tipo: 'Graduação',
    categoria: 'Graduação',
    carga_horaria: '1.600 horas',
    duracao: 'Forme-se em 2 anos'
  },
  chunks: [
    {
      id: 'chunk-1',
      content: 'Resumo do curso',
      metadata: { chunk_kind: 'course_summary' }
    },
    {
      id: 'chunk-2',
      content: 'Modulo parte 1',
      metadata: { chunk_kind: 'modules_part_1', split_from_kind: 'modules', split_part: 1, split_total: 2 }
    },
    {
      id: 'chunk-3',
      content: 'Modulo parte 2',
      metadata: { chunk_kind: 'modules_part_2', split_from_kind: 'modules', split_part: 2, split_total: 2 }
    },
    {
      id: 'chunk-4',
      content: 'FAQ do curso',
      metadata: { chunk_kind: 'faqs' }
    },
    {
      id: 'chunk-5',
      content: 'Diferenciais do curso',
      metadata: { chunk_kind: 'differentials' }
    }
  ]
};

describe('buildEnsCourseContext', () => {
  it('groups ENS course chunks into ordered full-context sections', () => {
    const context = buildEnsCourseContext(document);

    expect(context.course.title).toBe('Gestão de Seguros');
    expect(context.sections.map(section => section.kind)).toEqual([
      'course_summary',
      'modules',
      'faqs',
      'differentials'
    ]);
    expect(context.sections.find(section => section.kind === 'modules')?.content).toContain('Modulo parte 1');
    expect(context.sections.find(section => section.kind === 'modules')?.content).toContain('Modulo parte 2');
    expect(context.fullText).toContain('FAQ do curso');
    expect(context.fullText).toContain('Diferenciais do curso');
  });
});

