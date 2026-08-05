import { describe, expect, it } from 'vitest';
import { NotificationTypeSchema } from './notifications.js';

describe('approval notification contracts', () => {
  it('allows only the two minimized approval projections', () => {
    expect(NotificationTypeSchema.parse('approval_review')).toBe('approval_review');
    expect(NotificationTypeSchema.parse('approval_status')).toBe('approval_status');
    expect(NotificationTypeSchema.safeParse('approval_payload').success).toBe(false);
  });
});
