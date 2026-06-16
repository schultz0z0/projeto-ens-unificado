import { z } from 'zod/v4';

export const collectionSchema = z.enum(['courses', 'insights', 'institutional', 'marketing']);

export const searchIntentSchema = z.enum([
  'course_fact',
  'course_copy',
  'analytics',
  'institutional',
  'marketing_strategy',
  'general'
]);

export const marketingCategorySchema = z.enum([
  'copy',
  'campaign',
  'audience',
  'positioning',
  'creative_direction',
  'other'
]);
