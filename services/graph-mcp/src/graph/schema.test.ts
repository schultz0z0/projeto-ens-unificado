import { describe, expect, test } from 'vitest';
import {
  assertReadOnlyCypher,
  assertTenantScopedReadOnlyCypher,
  buildBootstrapPlan,
  DEFAULT_WHITE_LABEL_SEED,
  normalizeTenantId,
  resolveGraphContext
} from './schema.js';

describe('white-label graph schema', () => {
  test('normalizes tenant ids for shared white-label usage', () => {
    expect(normalizeTenantId('Acme Seguros')).toBe('acme-seguros');
    expect(normalizeTenantId('  ACME_Corp!!  ')).toBe('acme_corp');
    expect(normalizeTenantId('')).toBe('public');
  });

  test('default seed is generic across marketing, IT, and product', () => {
    const labels = DEFAULT_WHITE_LABEL_SEED.nodes.map(node => node.label);

    expect(labels).toContain('Marketing');
    expect(labels).toContain('TI');
    expect(labels).toContain('Produtos');
    expect(labels).not.toContain('Acme');
    expect(labels).not.toContain('Escola de Negocios e Seguros');
  });

  test('bootstrap plan scopes every seed node and relation to one tenant', () => {
    const context = resolveGraphContext({ tenantId: 'acme', userId: 'user-123' });
    const plan = buildBootstrapPlan(context, DEFAULT_WHITE_LABEL_SEED);

    expect(plan.constraints.length).toBeGreaterThan(0);
    expect(plan.seedNodes).toHaveLength(DEFAULT_WHITE_LABEL_SEED.nodes.length);
    expect(plan.seedNodes.every(item => item.params.tenant_id === 'acme')).toBe(true);
    expect(plan.seedRelations.every(item => item.params.tenant_id === 'acme')).toBe(true);
  });

  test('database-per-tenant strategy resolves an isolated tenant database name', () => {
    const context = resolveGraphContext({ tenantId: 'ENS Cliente', databaseStrategy: 'database-per-tenant' });

    expect(context).toMatchObject({
      tenantId: 'ens-cliente',
      database: 'nexus_tenant_ens-cliente',
      databaseStrategy: 'database-per-tenant'
    });
  });

  test('read-only cypher allows MATCH and rejects writes', () => {
    expect(() => assertReadOnlyCypher('MATCH (n) RETURN n LIMIT 5')).not.toThrow();
    expect(() => assertReadOnlyCypher('CREATE (n:Thing) RETURN n')).toThrow(/read-only/i);
    expect(() => assertReadOnlyCypher('MATCH (n) DETACH DELETE n')).toThrow(/read-only/i);
  });

  test('tenant-scoped cypher requires an explicit tenant filter', () => {
    expect(() => assertTenantScopedReadOnlyCypher(
      'MATCH (n:NexusGraphNode {tenant_id: $tenant_id}) RETURN n LIMIT 5'
    )).not.toThrow();
    expect(() => assertTenantScopedReadOnlyCypher('MATCH (n) RETURN n LIMIT 5')).toThrow(/tenant_id/i);
  });
});
