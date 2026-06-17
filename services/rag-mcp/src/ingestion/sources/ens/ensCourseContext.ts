import type { RagDocument } from '../../../rag/types.js';

export type EnsCourseContextSection = {
  kind: string;
  title: string;
  content: string;
  chunkIds: string[];
};

export type EnsCourseContext = {
  course: {
    documentId: string;
    title: string;
    sourceUri?: string;
    metadata: Record<string, unknown>;
  };
  sections: EnsCourseContextSection[];
  fullText: string;
};

const sectionOrder = [
  'course_summary',
  'course_description',
  'audience_requirements',
  'modules',
  'faculty',
  'course_offer',
  'visual_content',
  'faqs',
  'differentials',
  'testimonials'
];

const sectionTitles: Record<string, string> = {
  course_summary: 'Resumo do curso',
  course_description: 'Descricao do curso',
  audience_requirements: 'Publico-alvo e pre-requisitos',
  modules: 'Modulos e programa',
  faculty: 'Corpo docente',
  course_offer: 'Ofertas, inscricao e investimento',
  visual_content: 'Conteudo visual, bolsas, editais e links',
  faqs: 'FAQ',
  differentials: 'Diferenciais e vantagens',
  testimonials: 'Depoimentos'
};

export function buildEnsCourseContext(document: RagDocument): EnsCourseContext {
  const grouped = new Map<string, EnsCourseContextSection>();

  for (const chunk of document.chunks) {
    const kind = baseChunkKind(chunk.metadata);
    const current =
      grouped.get(kind) ??
      ({
        kind,
        title: sectionTitles[kind] ?? kind,
        content: '',
        chunkIds: []
      } satisfies EnsCourseContextSection);

    current.content = [current.content, chunk.content].filter(Boolean).join('\n\n');
    current.chunkIds.push(chunk.id);
    grouped.set(kind, current);
  }

  const sections = [...grouped.values()].sort(
    (a, b) => sectionIndex(a.kind) - sectionIndex(b.kind)
  );

  return {
    course: {
      documentId: document.id,
      title: document.title,
      sourceUri: document.sourceUri,
      metadata: document.metadata
    },
    sections,
    fullText: sections.map(section => `## ${section.title}\n${section.content}`).join('\n\n')
  };
}

function baseChunkKind(metadata: Record<string, unknown>): string {
  const splitFromKind = metadata.split_from_kind;
  if (typeof splitFromKind === 'string' && splitFromKind) {
    return splitFromKind;
  }

  const chunkKind = metadata.chunk_kind;
  if (typeof chunkKind === 'string' && chunkKind) {
    return chunkKind.replace(/_part_\d+$/, '');
  }

  return 'unknown';
}

function sectionIndex(kind: string): number {
  const index = sectionOrder.indexOf(kind);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

