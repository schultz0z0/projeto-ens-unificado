import { describe, expect, test } from 'vitest';
import {
  assertExplicitValidation,
  buildValidatedWorkGraphId,
  canManageValidatedWorks,
  normalizeProfileRole,
  normalizeValidatedWorkLimit,
  summarizeValidatedWork
} from './validatedWorks.js';

describe('validated work memory helpers', () => {
  test('normalizes legacy and new frontend roles', () => {
    expect(normalizeProfileRole('admin')).toBe('admin');
    expect(normalizeProfileRole('broker')).toBe('admin');
    expect(normalizeProfileRole('owner')).toBe('member');
    expect(normalizeProfileRole('manager')).toBe('manager');
    expect(normalizeProfileRole('member')).toBe('member');
    expect(normalizeProfileRole('tenant')).toBe('member');
    expect(normalizeProfileRole('user')).toBe('member');
    expect(normalizeProfileRole('unknown')).toBe('member');
  });

  test('allows only admin and manager to manage validated work', () => {
    expect(canManageValidatedWorks('admin')).toBe(true);
    expect(canManageValidatedWorks('manager')).toBe(true);
    expect(canManageValidatedWorks('member')).toBe(false);
    expect(canManageValidatedWorks('user')).toBe(false);
  });

  test('requires explicit approval before saving validated work', () => {
    expect(() => assertExplicitValidation({ validated: false, validation_note: 'ok' })).toThrow(/explicit user approval/i);
    expect(() => assertExplicitValidation({ validated: true, validation_note: '' })).toThrow(/validation_note/i);
    expect(() => assertExplicitValidation({ validated: true, validation_note: 'Rodrigo aprovou salvar.' })).not.toThrow();
  });

  test('caps search limits and builds stable graph references', () => {
    expect(normalizeValidatedWorkLimit(500, 50)).toBe(50);
    expect(normalizeValidatedWorkLimit(0, 50)).toBe(1);
    expect(buildValidatedWorkGraphId('abc')).toBe('validated_work:abc');
  });

  test('summarizes records without dropping audit fields', () => {
    const summary = summarizeValidatedWork({
      id: 'work-id',
      tenant_id: 'ens',
      artifact_type: 'copy',
      title: 'Copy validada',
      content: 'Texto aprovado',
      status: 'validated',
      validated_by_name: 'Rodrigo',
      validated_at: '2026-07-02T12:00:00.000Z'
    });
    expect(summary).toMatchObject({
      id: 'work-id',
      artifact_type: 'copy',
      title: 'Copy validada',
      content: 'Texto aprovado',
      validated_by_name: 'Rodrigo'
    });
  });
});
