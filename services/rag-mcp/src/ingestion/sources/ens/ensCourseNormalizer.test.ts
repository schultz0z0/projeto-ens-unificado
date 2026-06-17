import { describe, expect, it } from 'vitest';
import { normalizeEnsCourse, shouldIngestEnsCourse } from './ensCourseNormalizer.js';

const baseEnsItem = {
  curso: {
    nome: 'Curso ENS Exemplo',
    nome_academico: 'CURSO ENS EXEMPLO',
    carga_horaria: '20 horas',
    duracao: '2 meses',
    categoria: 'Pós',
    tipo: 'MBA',
    pre_requisito: 'Graduação completa.',
    id_academico: 'ENS-123',
    titulo_sobre: null,
    descricao: 'Descrição completa do curso.',
    liberar_curso: 'available',
    exibir_sempre_pagina_interna: false,
    publico_alvo: 'Profissionais do mercado.',
    certificado: null,
    modulos: [
      {
        titulo: 'Módulo I',
        subtitulo: 'Fundamentos',
        conteudo: 'Conteúdo do módulo.'
      }
    ],
    faqs: [],
    diferenciais_e_vantagens: [],
    depoimentos: [],
    conteudo_visual: {
      programa_ementa_titulo: 'Programa',
      programa_ementa_caminho_arquivo: 'https://example.com/programa.pdf',
      descricao: null
    }
  },
  docentes: [
    {
      nome: 'Pessoa Docente',
      ocupacao: 'Professora',
      categoria: 'Corpo Docente',
      email: null,
      mini_descricao: 'Mini bio.',
      curriculo: 'Curriculo completo.'
    }
  ],
  ofertas: [
    {
      id_oferta: 99,
      status_da_oferta: 'available',
      localidade: 'Online',
      id_localidade: '50',
      modalidade: 'Online - Aulas ao Vivo',
      oculto: false,
      turma_confirmada: false,
      link_inscr: [{ link: 'https://example.com/inscricao', text_button: 'INSCREVA-SE' }],
      investimento: 'Investimento: R$ 100,00',
      cond_pagamento: 'Pagamento em boleto.',
      info_inscricao: null,
      data_ini_aula: '10/09/2026 19:00',
      data_fim_aula: '30/03/2028 21:00',
      data_ini_inscr: '23/06/2025 10:00',
      data_fim_inscr: '09/09/2026 23:00',
      contato: 'inscricao@ens.edu.br',
      periodo: 'Terças e quintas',
      observacoes: null
    }
  ]
};

describe('ENS course normalizer', () => {
  it('skips only ENS courses with liberar_curso blocked and internal page false', () => {
    expect(
      shouldIngestEnsCourse({
        ...baseEnsItem,
        curso: {
          ...baseEnsItem.curso,
          liberar_curso: 'blocked',
          exibir_sempre_pagina_interna: false
        }
      })
    ).toBe(false);
  });

  it('keeps ENS courses that are blocked but have internal page enabled', () => {
    expect(
      shouldIngestEnsCourse({
        ...baseEnsItem,
        curso: {
          ...baseEnsItem.curso,
          liberar_curso: 'blocked',
          exibir_sempre_pagina_interna: true
        }
      })
    ).toBe(true);
  });

  it('keeps available ENS courses even when internal page is false', () => {
    expect(shouldIngestEnsCourse(baseEnsItem)).toBe(true);
  });

  it('normalizes one ENS course into a document with semantic chunks and metadata', () => {
    const document = normalizeEnsCourse(baseEnsItem);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('Curso ENS Exemplo');
    expect(document?.collection).toBe('courses');
    expect(document?.sourceId).toBe('ens_courses');
    expect(document?.sourceKey).toBe('ens-123:curso ens exemplo');
    expect(document?.metadata).toMatchObject({
      id_academico: 'ENS-123',
      course_id: 'ENS-123',
      course_category: 'Pós',
      course_type: 'MBA',
      course_status: 'available',
      liberar_curso: 'available',
      exibir_sempre_pagina_interna: false,
      modalidades: ['Online - Aulas ao Vivo'],
      localidades: ['Online']
    });
    expect(document?.chunks.map(chunk => chunk.kind)).toEqual([
      'course_summary',
      'course_description',
      'audience_requirements',
      'modules',
      'faculty',
      'course_offer',
      'visual_content'
    ]);

    const offerChunk = document?.chunks.find(chunk => chunk.kind === 'course_offer');
    expect(offerChunk?.content).toContain('Oferta 99');
    expect(offerChunk?.metadata).toMatchObject({
      chunk_kind: 'course_offer',
      course_id: 'ENS-123',
      course_name: 'Curso ENS Exemplo',
      course_category: 'Pós',
      course_type: 'MBA',
      course_status: 'available',
      offer_id: '99',
      offer_status: 'available',
      offer_modality: 'Online - Aulas ao Vivo',
      offer_location: 'Online',
      offer_location_id: '50',
      offer_hidden: false,
      offer_class_confirmed: false,
      offer_start_date: '2026-09-10T19:00:00.000Z',
      offer_end_date: '2028-03-30T21:00:00.000Z',
      enrollment_start_date: '2025-06-23T10:00:00.000Z',
      enrollment_end_date: '2026-09-09T23:00:00.000Z'
    });
  });

  it('creates one searchable chunk per ENS offer instead of mixing all offers together', () => {
    const document = normalizeEnsCourse({
      ...baseEnsItem,
      ofertas: [
        baseEnsItem.ofertas[0],
        {
          ...baseEnsItem.ofertas[0],
          id_oferta: 100,
          status_da_oferta: 'blocked',
          modalidade: 'Presencial',
          localidade: 'ENS Matriz | Rio de Janeiro - RJ',
          id_localidade: 'RJ',
          data_ini_aula: '15/10/2026 08:00',
          data_fim_aula: '15/12/2026 18:00',
          data_ini_inscr: '01/08/2026 10:00',
          data_fim_inscr: '10/10/2026 23:59'
        }
      ]
    });

    const offerChunks = document?.chunks.filter(chunk => chunk.kind === 'course_offer') ?? [];

    expect(offerChunks).toHaveLength(2);
    expect(offerChunks.map(chunk => chunk.metadata.offer_id)).toEqual(['99', '100']);
    expect(offerChunks.map(chunk => chunk.metadata.offer_status)).toEqual(['available', 'blocked']);
    expect(offerChunks.map(chunk => chunk.metadata.offer_modality)).toEqual(['Online - Aulas ao Vivo', 'Presencial']);
  });

  it('uses course name in ENS source keys to avoid duplicated id_academico collisions', () => {
    const first = normalizeEnsCourse({
      ...baseEnsItem,
      curso: { ...baseEnsItem.curso, id_academico: '6653', nome: 'Curso A' }
    });
    const second = normalizeEnsCourse({
      ...baseEnsItem,
      curso: { ...baseEnsItem.curso, id_academico: '6653', nome: 'Curso B' }
    });

    expect(first?.sourceKey).toBe('6653:curso a');
    expect(second?.sourceKey).toBe('6653:curso b');
  });

  it('does not generate chunks for empty ENS sections', () => {
    const document = normalizeEnsCourse({
      ...baseEnsItem,
      curso: {
        ...baseEnsItem.curso,
        publico_alvo: '',
        pre_requisito: '',
        modulos: [],
        conteudo_visual: {}
      },
      docentes: [],
      ofertas: []
    });

    expect(document?.chunks.map(chunk => chunk.kind)).toEqual(['course_summary', 'course_description']);
  });
});
