import { describe, expect, it } from 'vitest';
import { buildCourseSearchFilters } from './courseSearchPolicy.js';

describe('buildCourseSearchFilters', () => {
  it('infers active offer filters for enrollment and link queries', () => {
    expect(
      buildCourseSearchFilters({
        query: 'qual o link de inscricao e investimento do curso X',
        collections: ['courses'],
        intent: 'course_fact'
      })
    ).toMatchObject({
      chunkKinds: ['course_offer'],
      onlyActiveOffers: true
    });
  });

  it('does not force active offers when the query asks for blocked offers', () => {
    expect(
      buildCourseSearchFilters({
        query: 'quais ofertas bloqueadas do curso X',
        collections: ['courses'],
        intent: 'course_fact'
      })
    ).toMatchObject({
      chunkKinds: ['course_offer'],
      offerStatuses: ['blocked'],
      onlyActiveOffers: false
    });
  });

  it('lets explicit course filters override automatic defaults', () => {
    expect(
      buildCourseSearchFilters({
        query: 'ofertas do curso X',
        collections: ['courses'],
        intent: 'course_fact',
        explicitFilters: {
          chunkKinds: ['course_summary'],
          offerStatuses: ['available'],
          onlyActiveOffers: false
        }
      })
    ).toMatchObject({
      chunkKinds: ['course_summary'],
      offerStatuses: ['available'],
      onlyActiveOffers: false
    });
  });

  it('returns undefined when courses are not part of the search', () => {
    expect(
      buildCourseSearchFilters({
        query: 'tom de voz WhatsApp',
        collections: ['marketing'],
        intent: 'marketing_strategy'
      })
    ).toBeUndefined();
  });
});
