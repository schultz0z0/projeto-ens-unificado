import type { EnsRagCollection, RagSearchIntent } from '../rag/types.js';

export const ENS_RAG_COLLECTIONS: EnsRagCollection[] = ['courses', 'insights', 'institutional', 'marketing'];

export function normalizeCollections(collections?: EnsRagCollection[]): EnsRagCollection[] {
  const unique = [...new Set(collections ?? [])];
  return unique.length > 0 ? unique : [...ENS_RAG_COLLECTIONS];
}

export function defaultCollectionsForIntent(intent?: RagSearchIntent): EnsRagCollection[] {
  switch (intent) {
    case 'course_fact':
    case 'course_copy':
      return ['courses'];
    case 'analytics':
      return ['insights', 'courses'];
    case 'institutional':
      return ['institutional'];
    case 'marketing_strategy':
      return ['marketing', 'courses', 'insights'];
    default:
      return [...ENS_RAG_COLLECTIONS];
  }
}

export function canHermesWriteCollection(collection: EnsRagCollection): boolean {
  return collection === 'insights' || collection === 'marketing';
}

export function assertMarketingValidation(input: { userValidated?: boolean; validationNote?: string }): void {
  if (!input.userValidated || !input.validationNote?.trim()) {
    throw new Error('Marketing memory requires explicit user validation and a validation note.');
  }
}
