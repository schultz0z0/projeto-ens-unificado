import type { EnsRagCollection, RagCourseSearchFilters, RagSearchIntent } from '../rag/types.js';

export function buildCourseSearchFilters(input: {
  query: string;
  collections: EnsRagCollection[];
  intent?: RagSearchIntent;
  explicitFilters?: RagCourseSearchFilters;
}): RagCourseSearchFilters | undefined {
  if (!input.collections.includes('courses')) {
    return undefined;
  }

  const explicit = compactFilters(input.explicitFilters);
  const query = normalize(input.query);
  const offerQuery = hasOfferIntent(query);
  const blockedQuery = /\b(bloquead|indisponivel|indisponiveis|encerrad|inativ)\w*/i.test(query);

  const inferred: RagCourseSearchFilters = {};
  if (offerQuery) {
    inferred.chunkKinds = ['course_offer'];
    inferred.onlyActiveOffers = !blockedQuery;
  }

  if (blockedQuery) {
    inferred.offerStatuses = ['blocked'];
    inferred.onlyActiveOffers = false;
  }

  const merged = compactFilters({
    ...inferred,
    ...explicit
  });

  return hasAnyFilter(merged) ? merged : undefined;
}

function compactFilters(filters?: RagCourseSearchFilters): RagCourseSearchFilters | undefined {
  if (!filters) {
    return undefined;
  }

  return {
    chunkKinds: compactArray(filters.chunkKinds),
    courseCategories: compactArray(filters.courseCategories),
    courseTypes: compactArray(filters.courseTypes),
    courseStatuses: compactArray(filters.courseStatuses),
    offerStatuses: compactArray(filters.offerStatuses),
    modalities: compactArray(filters.modalities),
    localities: compactArray(filters.localities),
    onlyActiveOffers: filters.onlyActiveOffers,
    offerStartFrom: clean(filters.offerStartFrom),
    offerStartTo: clean(filters.offerStartTo),
    enrollmentOpenAt: clean(filters.enrollmentOpenAt)
  };
}

function hasAnyFilter(filters?: RagCourseSearchFilters): boolean {
  if (!filters) {
    return false;
  }

  return Object.values(filters).some(value => (Array.isArray(value) ? value.length > 0 : value !== undefined));
}

function hasOfferIntent(query: string): boolean {
  return /\b(oferta|ofertas|inscri|inscricao|inscrição|link|data|inicio|início|investimento|valor|preco|preço|modalidade|turma|aula|matricula|matrícula)\b/i.test(
    query
  );
}

function compactArray(values?: string[]): string[] | undefined {
  const cleaned = [...new Set((values ?? []).map(clean).filter((value): value is string => Boolean(value)))];
  return cleaned.length > 0 ? cleaned : undefined;
}

function clean(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
