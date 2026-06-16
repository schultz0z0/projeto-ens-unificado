import { describe, expect, it } from 'vitest';
import { assertTenantAccess, resolveTenantScope } from './tenantPolicy.js';

const basePolicy = {
  commonTenant: 'ens',
  adminProfiles: ['ceo', 'default'],
  maxLimit: 20,
  defaultLimit: 8
};

describe('tenant policy', () => {
  it('allows a specialist to access the common tenant and active client', () => {
    const scope = resolveTenantScope({
      actorProfile: 'marketing-specialist',
      activeClient: 'cliente_acme',
      requestedTenants: ['ens', 'cliente_acme'],
      adminMode: false,
      policy: basePolicy
    });

    expect(scope.allowedTenants).toEqual(['ens', 'cliente_acme']);
    expect(scope.isAdmin).toBe(false);
  });

  it('denies a specialist that requests a tenant outside the active scope', () => {
    expect(() =>
      assertTenantAccess({
        actorProfile: 'marketing-specialist',
        activeClient: 'cliente_acme',
        requestedTenants: ['cliente_beta'],
        adminMode: false,
        policy: basePolicy
      })
    ).toThrow('Access denied: tenant cliente_beta is outside the active task scope.');
  });

  it('limits a specialist without active client to the common tenant', () => {
    const scope = resolveTenantScope({
      actorProfile: 'researcher',
      requestedTenants: undefined,
      adminMode: false,
      policy: basePolicy
    });

    expect(scope.allowedTenants).toEqual(['ens']);
  });

  it('requires explicit admin mode before an admin profile can access arbitrary tenants', () => {
    expect(() =>
      assertTenantAccess({
        actorProfile: 'ceo',
        activeClient: 'cliente_acme',
        requestedTenants: ['cliente_beta'],
        adminMode: false,
        policy: basePolicy
      })
    ).toThrow('Access denied: tenant cliente_beta is outside the active task scope.');

    const scope = assertTenantAccess({
      actorProfile: 'ceo',
      activeClient: 'cliente_acme',
      requestedTenants: ['cliente_beta'],
      adminMode: true,
      policy: basePolicy
    });

    expect(scope.allowedTenants).toEqual(['cliente_beta']);
    expect(scope.isAdmin).toBe(true);
  });
});

