import type { IngestionDocument, IngestionChunk } from '../../types.js';
import { cleanText, compactArray, joinSections, section, stableKey } from '../../text.js';

export type EnsCourseItem = {
  curso?: Record<string, any>;
  docentes?: Array<Record<string, any>>;
  ofertas?: Array<Record<string, any>>;
};

const sourceId = 'ens_courses';

export function shouldIngestEnsCourse(item: EnsCourseItem): boolean {
  const curso = item.curso ?? {};
  return !(curso.liberar_curso === 'blocked' && curso.exibir_sempre_pagina_interna === false);
}

export function normalizeEnsCourse(item: EnsCourseItem, tenantSlug = 'ens'): IngestionDocument | null {
  if (!shouldIngestEnsCourse(item)) {
    return null;
  }

  const curso = item.curso ?? {};
  const docentes = item.docentes ?? [];
  const ofertas = item.ofertas ?? [];
  const title = cleanText(curso.nome || curso.nome_academico || 'Curso ENS');
  const sourceKey = stableKey(curso.id_academico, title) || stableKey(title, curso.tipo, curso.categoria);
  const modalities = compactArray(ofertas.map(oferta => oferta.modalidade));
  const locations = compactArray(ofertas.map(oferta => oferta.localidade));
  const offerStatuses = compactArray(ofertas.map(oferta => oferta.status_da_oferta));
  const programUri = cleanText(curso.conteudo_visual?.programa_ementa_caminho_arquivo);
  const sourceUri = firstEnrollmentLink(ofertas) ?? (programUri || undefined);
  const chunks = buildEnsChunks(curso, docentes, ofertas);

  if (chunks.length === 0) {
    return null;
  }

  return {
    tenantSlug,
    sourceId,
    sourceKey,
    title,
    sourceType: 'ens_api_course',
    sourceUri,
    visibility: 'client',
    metadata: {
      id_academico: cleanText(curso.id_academico),
      nome_academico: cleanText(curso.nome_academico),
      categoria: cleanText(curso.categoria),
      tipo: cleanText(curso.tipo),
      carga_horaria: cleanText(curso.carga_horaria),
      duracao: cleanText(curso.duracao),
      liberar_curso: cleanText(curso.liberar_curso),
      exibir_sempre_pagina_interna: Boolean(curso.exibir_sempre_pagina_interna),
      modalidades: modalities,
      localidades: locations,
      status_ofertas: offerStatuses,
      quantidade_docentes: docentes.length,
      quantidade_ofertas: ofertas.length
    },
    chunks
  };
}

function buildEnsChunks(curso: Record<string, any>, docentes: Array<Record<string, any>>, ofertas: Array<Record<string, any>>): IngestionChunk[] {
  const chunks: IngestionChunk[] = [];
  const title = cleanText(curso.nome || curso.nome_academico || 'Curso ENS');

  addChunk(chunks, 'course_summary', {
    title,
    content: joinSections([
      section('Curso', title),
      section('Nome academico', curso.nome_academico),
      section('Categoria', curso.categoria),
      section('Tipo', curso.tipo),
      section('Carga horaria', curso.carga_horaria),
      section('Duracao', curso.duracao)
    ]),
    metadata: { section: 'summary' }
  });

  addChunk(chunks, 'course_description', {
    title,
    content: joinSections([
      section('Titulo sobre', curso.titulo_sobre),
      section('Descricao', curso.descricao || curso.conteudo_visual?.descricao),
      section('Certificado', curso.certificado)
    ]),
    metadata: { section: 'description' }
  });

  addChunk(chunks, 'audience_requirements', {
    title,
    content: joinSections([section('Publico alvo', curso.publico_alvo), section('Pre-requisito', curso.pre_requisito)]),
    metadata: { section: 'audience_requirements' }
  });

  addChunk(chunks, 'modules', {
    title,
    content: formatModules(curso.modulos ?? []),
    metadata: { section: 'modules', count: Array.isArray(curso.modulos) ? curso.modulos.length : 0 }
  });

  addChunk(chunks, 'faculty', {
    title,
    content: formatFaculty(docentes),
    metadata: { section: 'faculty', count: docentes.length }
  });

  addChunk(chunks, 'offers', {
    title,
    content: formatOffers(ofertas),
    metadata: { section: 'offers', count: ofertas.length }
  });

  addChunk(chunks, 'visual_content', {
    title,
    content: formatVisualContent(curso.conteudo_visual ?? {}),
    metadata: { section: 'visual_content' }
  });

  addChunk(chunks, 'faqs', {
    title,
    content: formatGenericList('FAQs', curso.faqs ?? []),
    metadata: { section: 'faqs', count: Array.isArray(curso.faqs) ? curso.faqs.length : 0 }
  });

  addChunk(chunks, 'differentials', {
    title,
    content: formatGenericList('Diferenciais e vantagens', curso.diferenciais_e_vantagens ?? []),
    metadata: {
      section: 'differentials',
      count: Array.isArray(curso.diferenciais_e_vantagens) ? curso.diferenciais_e_vantagens.length : 0
    }
  });

  addChunk(chunks, 'testimonials', {
    title,
    content: formatGenericList('Depoimentos', curso.depoimentos ?? []),
    metadata: { section: 'testimonials', count: Array.isArray(curso.depoimentos) ? curso.depoimentos.length : 0 }
  });

  return chunks;
}

function addChunk(
  chunks: IngestionChunk[],
  kind: string,
  input: { title: string; content: string; metadata: Record<string, unknown> }
): void {
  const content = cleanText(input.content);
  if (!content) {
    return;
  }

  chunks.push({
    kind,
    content: `Curso ENS: ${input.title}\n\n${content}`,
    metadata: input.metadata
  });
}

function formatModules(modules: Array<Record<string, any>>): string {
  if (!Array.isArray(modules) || modules.length === 0) {
    return '';
  }

  return modules
    .map(module =>
      joinSections([
        section('Modulo', module.titulo),
        section('Subtitulo', module.subtitulo),
        section('Conteudo', module.conteudo)
      ])
    )
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function formatFaculty(faculty: Array<Record<string, any>>): string {
  return faculty
    .map(person =>
      joinSections([
        section('Docente', person.nome),
        section('Ocupacao', person.ocupacao),
        section('Categoria', person.categoria),
        section('Mini descricao', person.mini_descricao),
        section('Curriculo', person.curriculo)
      ])
    )
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function formatOffers(offers: Array<Record<string, any>>): string {
  return offers
    .map(offer =>
      joinSections([
        section('Oferta', offer.id_oferta),
        section('Status', offer.status_da_oferta),
        section('Localidade', offer.localidade),
        section('Modalidade', offer.modalidade),
        section('Turma confirmada', offer.turma_confirmada),
        section('Investimento', offer.investimento),
        section('Condicao de pagamento', offer.cond_pagamento),
        section('Informacoes de inscricao', offer.info_inscricao),
        section('Inicio das aulas', offer.data_ini_aula),
        section('Fim das aulas', offer.data_fim_aula),
        section('Inicio das inscricoes', offer.data_ini_inscr),
        section('Fim das inscricoes', offer.data_fim_inscr),
        section('Periodo', offer.periodo),
        section('Contato', offer.contato),
        section('Link de inscricao', firstEnrollmentLink([offer])),
        section('Observacoes', offer.observacoes)
      ])
    )
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function formatVisualContent(visual: Record<string, any>): string {
  return joinSections([
    section('Bolsas e descontos', visual.bolsas_e_descontos),
    section('Formas de ingresso, editais e processos', visual.formas_de_ingresso_editais_processos),
    section('Edital ou regulamento', visual.edital_regulamento_caminho_arquivo),
    section('Programa ou ementa', visual.programa_ementa_caminho_arquivo),
    section('Especial', visual.especial_conteudo),
    section('Descricao visual', visual.descricao)
  ]);
}

function formatGenericList(title: string, list: unknown[]): string {
  if (!Array.isArray(list) || list.length === 0) {
    return '';
  }

  return `${title}\n${list.map(item => (typeof item === 'object' ? JSON.stringify(item) : cleanText(item))).join('\n')}`;
}

function firstEnrollmentLink(offers: Array<Record<string, any>>): string | undefined {
  for (const offer of offers) {
    if (Array.isArray(offer.link_inscr)) {
      const match = offer.link_inscr.find((link: Record<string, any>) => cleanText(link.link));
      if (match) {
        return cleanText(match.link);
      }
    }

    const external = cleanText(offer.link_inscr_externo || offer.link_inscr_externo_pj);
    if (external) {
      return external;
    }
  }

  return undefined;
}
