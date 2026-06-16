import { describe, expect, it } from 'vitest';
import {
  assertMarketingValidation,
  canHermesWriteCollection,
  defaultCollectionsForIntent,
  normalizeCollections
} from './collectionPolicy.js';

describe('collectionPolicy', () => {
  it('routes course intents only to the courses collection', () => {
    expect(defaultCollectionsForIntent('course_fact')).toEqual(['courses']);
    expect(defaultCollectionsForIntent('course_copy')).toEqual(['courses']);
  });

  it('routes analytics to insights with course evidence available', () => {
    expect(defaultCollectionsForIntent('analytics')).toEqual(['insights', 'courses']);
  });

  it('defaults empty collection filters to every ENS collection', () => {
    expect(normalizeCollections([])).toEqual(['courses', 'insights', 'institutional', 'marketing']);
  });

  it('allows Hermes writes only to insights and validated marketing flows', () => {
    expect(canHermesWriteCollection('insights')).toBe(true);
    expect(canHermesWriteCollection('marketing')).toBe(true);
    expect(canHermesWriteCollection('courses')).toBe(false);
    expect(canHermesWriteCollection('institutional')).toBe(false);
  });

  it('requires explicit user validation before marketing memory writes', () => {
    expect(() => assertMarketingValidation({ userValidated: true, validationNote: 'Aprovado pelo usuario.' })).not.toThrow();
    expect(() => assertMarketingValidation({ userValidated: false, validationNote: 'rascunho' })).toThrow(
      /requires explicit user validation/i
    );
    expect(() => assertMarketingValidation({ userValidated: true, validationNote: ' ' })).toThrow(
      /requires explicit user validation/i
    );
  });
});
