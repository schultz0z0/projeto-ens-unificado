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

export const courseChunkKindSchema = z.enum([
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
]);

export const courseFiltersSchema = z
  .object({
    chunk_kinds: z.array(courseChunkKindSchema).optional(),
    course_categories: z.array(z.string().min(1)).optional(),
    course_types: z.array(z.string().min(1)).optional(),
    course_statuses: z.array(z.enum(['available', 'blocked'])).optional(),
    offer_statuses: z.array(z.enum(['available', 'blocked'])).optional(),
    modalities: z.array(z.string().min(1)).optional(),
    localities: z.array(z.string().min(1)).optional(),
    only_active_offers: z.boolean().optional(),
    offer_start_from: z.string().datetime().optional(),
    offer_start_to: z.string().datetime().optional(),
    enrollment_open_at: z.string().datetime().optional()
  })
  .optional();
