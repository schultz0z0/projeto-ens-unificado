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
  const courseId = cleanText(curso.id_academico);
  const courseCategory = cleanText(curso.categoria);
  const courseType = cleanText(curso.tipo);
  const courseStatus = cleanText(curso.liberar_curso);
  const sourceKey = stableKey(curso.id_academico, title) || stableKey(title, curso.tipo, curso.categoria);
  const modalities = compactArray(ofertas.map(oferta => oferta.modalidade));
  const locations = compactArray(ofertas.map(oferta => oferta.localidade));
  const offerStatuses = compactArray(ofertas.map(oferta => oferta.status_da_oferta));
  const programUri = cleanText(curso.conteudo_visual?.programa_ementa_caminho_arquivo);
  const sourceUri = firstEnrollmentLink(ofertas) ?? (programUri || undefined);
  const commonMetadata = {
    course_id: courseId,
    course_name: title,
    course_category: courseCategory,
    course_type: courseType,
    course_level: courseType || courseCategory,
    course_status: courseStatus
  };
  const chunks = buildEnsChunks(curso, docentes, ofertas, commonMetadata);

  if (chunks.length === 0) {
    return null;
  }

  return {
    tenantSlug,
    collection: 'courses',
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
      ...commonMetadata,
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

function buildEnsChunks(
  curso: Record<string, any>,
  docentes: Array<Record<string, any>>,
  ofertas: Array<Record<string, any>>,
  commonMetadata: Record<string, unknown>
): IngestionChunk[] {
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
    metadata: { ...commonMetadata, section: 'summary' }
  });

  addChunk(chunks, 'course_description', {
    title,
    content: joinSections([
      section('Titulo sobre', curso.titulo_sobre),
      section('Descricao', curso.descricao || curso.conteudo_visual?.descricao),
      section('Certificado', curso.certificado)
    ]),
    metadata: { ...commonMetadata, section: 'description' }
  });

  addChunk(chunks, 'audience_requirements', {
    title,
    content: joinSections([section('Publico alvo', curso.publico_alvo), section('Pre-requisito', curso.pre_requisito)]),
    metadata: { ...commonMetadata, section: 'audience_requirements' }
  });

  addChunk(chunks, 'modules', {
    title,
    content: formatModules(curso.modulos ?? []),
    metadata: { ...commonMetadata, section: 'modules', count: Array.isArray(curso.modulos) ? curso.modulos.length : 0 }
  });

  addChunk(chunks, 'faculty', {
    title,
    content: formatFaculty(docentes),
    metadata: { ...commonMetadata, section: 'faculty', count: docentes.length }
  });

  for (const oferta of ofertas) {
    const offerMetadata = buildOfferMetadata(oferta, commonMetadata);
    addChunk(chunks, 'course_offer', {
      title,
      content: formatOffer(oferta),
      metadata: { ...offerMetadata, section: 'offer' }
    });
  }

  addChunk(chunks, 'visual_content', {
    title,
    content: formatVisualContent(curso.conteudo_visual ?? {}),
    metadata: { ...commonMetadata, section: 'visual_content' }
  });

  addChunk(chunks, 'faqs', {
    title,
    content: formatGenericList('FAQs', curso.faqs ?? []),
    metadata: { ...commonMetadata, section: 'faqs', count: Array.isArray(curso.faqs) ? curso.faqs.length : 0 }
  });

  addChunk(chunks, 'differentials', {
    title,
    content: formatGenericList('Diferenciais e vantagens', curso.diferenciais_e_vantagens ?? []),
    metadata: {
      ...commonMetadata,
      section: 'differentials',
      count: Array.isArray(curso.diferenciais_e_vantagens) ? curso.diferenciais_e_vantagens.length : 0
    }
  });

  addChunk(chunks, 'testimonials', {
    title,
    content: formatGenericList('Depoimentos', curso.depoimentos ?? []),
    metadata: { ...commonMetadata, section: 'testimonials', count: Array.isArray(curso.depoimentos) ? curso.depoimentos.length : 0 }
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
    metadata: {
      chunk_kind: kind,
      ...input.metadata
    }
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

function formatOffer(offer: Record<string, any>): string {
  const offerId = cleanText(offer.id_oferta);
  return joinSections([
    offerId ? `Oferta ${offerId}` : '',
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
    section('Virada de descontos', offer.virada_de_descontos),
    section('Observacoes', offer.observacoes)
  ]);
}

function buildOfferMetadata(offer: Record<string, any>, commonMetadata: Record<string, unknown>): Record<string, unknown> {
  const enrollmentLink = firstEnrollmentLink([offer]);
  return {
    ...commonMetadata,
    offer_id: cleanText(offer.id_oferta),
    offer_status: cleanText(offer.status_da_oferta),
    offer_modality: cleanText(offer.modalidade),
    offer_location: cleanText(offer.localidade),
    offer_location_id: cleanText(offer.id_localidade),
    offer_hidden: Boolean(offer.oculto),
    offer_class_confirmed: Boolean(offer.turma_confirmada),
    offer_investment: cleanText(offer.investimento),
    offer_payment_terms: cleanText(offer.cond_pagamento),
    offer_period: cleanText(offer.periodo),
    offer_contact: cleanText(offer.contato),
    offer_enrollment_link: enrollmentLink ?? null,
    offer_start_date: parseEnsDateTime(offer.data_ini_aula),
    offer_end_date: parseEnsDateTime(offer.data_fim_aula),
    enrollment_start_date: parseEnsDateTime(offer.data_ini_inscr),
    enrollment_end_date: parseEnsDateTime(offer.data_fim_inscr)
  };
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

function parseEnsDateTime(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) {
    return null;
  }

  const [, day, month, year, hour = '0', minute = '0'] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
