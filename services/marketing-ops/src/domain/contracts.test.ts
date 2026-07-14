import { describe, expect, it } from 'vitest';
import { authorize } from '../auth/permissions.js';
import {
  assertTransitionAllowed,
  CampaignInputSchema,
  CampaignPatchSchema,
  validatePlanningReadiness,
  type CampaignPlanningReadiness
} from './contracts.js';

const completeInput = {
  name: '  Lancamento 2026  ',
  objective: '  Apresentar a nova oferta  ',
  referenceType: 'product' as const,
  referenceKey: null,
  referenceTitleSnapshot: '  Produto ENS  ',
  referenceDocumentId: null,
  audience: null,
  startsOn: '2026-08-01',
  endsOn: '2026-08-31',
  primaryChannel: 'email' as const,
  secondaryChannels: ['instagram', 'linkedin'] as const,
  briefing: null,
  notes: null
};

const readyCampaign = (overrides: Partial<CampaignPlanningReadiness> = {}): CampaignPlanningReadiness => ({
  name: 'Lancamento 2026',
  objective: 'Apresentar a nova oferta',
  referenceType: 'product',
  referenceKey: null,
  referenceTitleSnapshot: 'Produto ENS',
  referenceDocumentId: null,
  referenceVerifiedAt: null,
  startsOn: '2026-08-01',
  endsOn: '2026-08-31',
  hasPrimaryOwner: true,
  ...overrides
});

function captureError(action: () => void) {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('expected action to throw');
}

describe('campaign input contracts', () => {
  it('parses the complete editable shape and normalizes trimmed text', () => {
    const parsed = CampaignInputSchema.parse(completeInput);
    expect(parsed).toMatchObject({
      name: 'Lancamento 2026',
      objective: 'Apresentar a nova oferta',
      referenceTitleSnapshot: 'Produto ENS'
    });
  });

  it('keeps PATCH strict and requires at least one editable field', () => {
    expect(CampaignPatchSchema.parse({ notes: '  acompanhar semanalmente  ' })).toEqual({
      notes: 'acompanhar semanalmente'
    });
    expect(() => CampaignPatchSchema.parse({})).toThrow();
    expect(() => CampaignPatchSchema.parse({ status: 'active' })).toThrow();
  });

  it('rejects invalid periods and inconsistent channels', () => {
    expect(() => CampaignInputSchema.parse({
      ...completeInput,
      startsOn: '2026-09-01',
      endsOn: '2026-08-01'
    })).toThrow();
    expect(() => CampaignInputSchema.parse({
      ...completeInput,
      secondaryChannels: ['instagram', 'instagram']
    })).toThrow();
    expect(() => CampaignInputSchema.parse({
      ...completeInput,
      secondaryChannels: ['email']
    })).toThrow();
  });
});

describe('campaign planning readiness', () => {
  it('reports the complete planning minimum when fields are absent', () => {
    const error = captureError(() => validatePlanningReadiness(readyCampaign({
      name: ' ',
      objective: null,
      referenceType: null,
      referenceTitleSnapshot: null,
      startsOn: null,
      endsOn: null,
      hasPrimaryOwner: false
    })));
    expect(error).toMatchObject({
      code: 'campaign_requirements_missing',
      status: 422,
      details: {
        fields: [
          'name', 'objective', 'referenceType', 'referenceTitleSnapshot',
          'startsOn', 'endsOn', 'primaryOwner'
        ]
      }
    });
  });

  it('rejects an invalid planning period', () => {
    expect(captureError(() => validatePlanningReadiness(readyCampaign({
      startsOn: '2026-09-01',
      endsOn: '2026-08-01'
    })))).toMatchObject({
      code: 'campaign_requirements_missing',
      details: { fields: ['period'] }
    });
  });

  it('requires an official verified document for course references', () => {
    const error = captureError(() => validatePlanningReadiness(readyCampaign({
      referenceType: 'course',
      referenceKey: 'curso-123',
      referenceDocumentId: null,
      referenceVerifiedAt: null
    })));
    expect(error).toMatchObject({
      code: 'reference_not_verified',
      status: 422,
      details: { referenceType: 'course' }
    });
  });

  it('accepts product readiness and a fully verified course', () => {
    expect(() => validatePlanningReadiness(readyCampaign())).not.toThrow();
    expect(() => validatePlanningReadiness(readyCampaign({
      referenceType: 'course',
      referenceKey: 'curso-123',
      referenceDocumentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      referenceVerifiedAt: '2026-07-14T12:00:00.000Z'
    }))).not.toThrow();
  });
});

describe('campaign transition matrix', () => {
  const member = { role: 'member' as const };
  const manager = { role: 'manager' as const };
  const admin = { role: 'admin' as const };
  const primaryOwner = { memberRole: 'owner' as const, isPrimary: true };

  it('allows the primary owner, manager, and admin to advance one state', () => {
    expect(() => assertTransitionAllowed(member, primaryOwner, 'draft', 'planned')).not.toThrow();
    expect(() => assertTransitionAllowed(manager, null, 'planned', 'active')).not.toThrow();
    expect(() => assertTransitionAllowed(admin, null, 'active', 'completed')).not.toThrow();
  });

  it('denies forward transitions to editors and non-primary owners', () => {
    expect(captureError(() => assertTransitionAllowed(
      member,
      { memberRole: 'editor', isPrimary: false },
      'draft',
      'planned'
    ))).toMatchObject({ code: 'forbidden', status: 403 });
    expect(captureError(() => assertTransitionAllowed(
      member,
      { memberRole: 'owner', isPrimary: false },
      'planned',
      'active'
    ))).toMatchObject({ code: 'forbidden', status: 403 });
  });

  it('allows reopen only to manager and admin', () => {
    expect(captureError(() => assertTransitionAllowed(
      member,
      primaryOwner,
      'planned',
      'draft'
    ))).toMatchObject({ code: 'forbidden', status: 403 });
    expect(() => assertTransitionAllowed(manager, null, 'planned', 'draft')).not.toThrow();
    expect(() => assertTransitionAllowed(admin, null, 'completed', 'active')).not.toThrow();
  });

  it('allows only manager and admin to archive a nonarchived campaign', () => {
    expect(captureError(() => assertTransitionAllowed(
      member,
      primaryOwner,
      'active',
      'archived'
    ))).toMatchObject({ code: 'forbidden', status: 403 });
    expect(() => assertTransitionAllowed(manager, null, 'draft', 'archived')).not.toThrow();
    expect(() => assertTransitionAllowed(admin, null, 'completed', 'archived')).not.toThrow();
  });

  it('rejects skipped edges and treats archived as terminal', () => {
    expect(captureError(() => assertTransitionAllowed(
      manager,
      null,
      'draft',
      'active'
    ))).toMatchObject({ code: 'invalid_transition', status: 409 });
    expect(captureError(() => assertTransitionAllowed(
      admin,
      null,
      'archived',
      'completed'
    ))).toMatchObject({ code: 'invalid_transition', status: 409 });
  });

  it('exposes coarse permissions that agree with the domain matrix', () => {
    const actor = (role: 'member' | 'manager' | 'admin') => ({
      userId: 'u', tenantId: 't', tenantSlug: 'ens', role
    });
    expect(() => authorize(actor('member'), 'campaign.transition')).not.toThrow();
    expect(() => authorize(actor('member'), 'campaign.reopen')).toThrow();
    expect(() => authorize(actor('manager'), 'campaign.reopen')).not.toThrow();
    expect(() => authorize(actor('admin'), 'campaign.archive')).not.toThrow();
  });
});
