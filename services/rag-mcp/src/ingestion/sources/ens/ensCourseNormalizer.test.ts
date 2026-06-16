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
    expect(document?.sourceId).toBe('ens_courses');
    expect(document?.sourceKey).toBe('ens-123:curso ens exemplo');
    expect(document?.metadata).toMatchObject({
      id_academico: 'ENS-123',
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
      'offers',
      'visual_content'
    ]);
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
