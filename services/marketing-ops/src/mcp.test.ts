import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { verifyDelegation } from './delegation/verifier.js';
import { createMarketingOpsMcpServer } from './mcp/createServer.js';

const pool = new pg.Pool({ connectionString: process.env.MARKETING_OPS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
const activeKey = 'active-local-delegation-key-at-least-32-bytes';
const keyring = { activeKid: 'v2', activeKey, previousKid: 'v1', previousKey: 'previous-local-delegation-key-32-bytes', issuer: 'nexus-chat-bridge', audience: 'nexus-marketing-ops', maxTtlSeconds: 120 };
afterAll(() => pool.end());

async function token(
  overrides: Record<string, unknown> = {},
  key = activeKey,
  kid = 'v2',
  ttlSeconds = 60,
  issuedAt = Math.floor(Date.now() / 1000)
) {
  return new SignJWT({
    tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', actor_role: 'member',
    scopes: ['campaign:read', 'campaign:write'], chat_session_id: randomUUID(), run_id: randomUUID(),
    correlation_id: randomUUID(), contract_version: 1, ...overrides
  }).setProtectedHeader({ alg: 'HS256', kid }).setIssuer('nexus-chat-bridge').setAudience('nexus-marketing-ops')
    .setSubject('11111111-1111-4111-8111-111111111111').setJti(randomUUID()).setIssuedAt(issuedAt).setNotBefore(issuedAt - 1).setExpirationTime(issuedAt + ttlSeconds)
    .sign(new TextEncoder().encode(key));
}

describe('delegation and MCP', () => {
  it('verifies a short delegation against the current membership', async () => {
    const delegated = await verifyDelegation(await token(), ['campaign:read'], { pool, keyring });
    expect(delegated).toMatchObject({ userId: '11111111-1111-4111-8111-111111111111', role: 'member', tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  });

  it('rejects missing scopes, unknown kid and excessive TTL', async () => {
    await expect(verifyDelegation(await token({ scopes: ['campaign:read'] }), ['campaign:write'], { pool, keyring })).rejects.toMatchObject({ code: 'delegation_scope_denied' });
    await expect(verifyDelegation(await token({}, activeKey, 'unknown'), ['campaign:read'], { pool, keyring })).rejects.toMatchObject({ code: 'delegation_invalid' });
    await expect(verifyDelegation(await token({}, activeKey, 'v2', 300), ['campaign:read'], { pool, keyring })).rejects.toMatchObject({ code: 'delegation_invalid' });
  });

  it('consumes mutation jti once', async () => {
    const signed = await token();
    const operation = { name: 'campaign.create', idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64) };
    await verifyDelegation(signed, ['campaign:write'], { pool, keyring, operation });
    await expect(verifyDelegation(signed, ['campaign:write'], { pool, keyring, operation })).rejects.toMatchObject({ code: 'delegation_replay' });
  });

  it('renews once when a valid delegation expires during the Hermes run', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await token({}, activeKey, 'v2', 60, now - 120);
    const fresh = await token();
    const refreshDelegation = vi.fn().mockResolvedValue(fresh);

    const delegated = await verifyDelegation(expired, ['campaign:read'], {
      pool,
      keyring,
      refreshDelegation
    });

    expect(refreshDelegation).toHaveBeenCalledOnce();
    expect(refreshDelegation).toHaveBeenCalledWith(expired);
    expect(delegated).toMatchObject({
      userId: '11111111-1111-4111-8111-111111111111',
      role: 'member',
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    });
  });

  it('canonicalizes a tenant slug before consuming a mutation delegation', async () => {
    const signed = await token({ tenant_id: 'ens' });
    const operation = { name: 'campaign.create', idempotencyKey: randomUUID(), requestHash: 'b'.repeat(64) };
    const actor = await verifyDelegation(signed, ['campaign:write'], { pool, keyring, operation });
    expect(actor.tenantId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('registers versioned tools and serves public capabilities', async () => {
    const server = createMarketingOpsMcpServer({ pool, features: { read: true, write: true }, keyring });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain('marketing_ops_create_campaign_draft_v1');
    const result = await client.callTool({ name: 'marketing_ops_capabilities_v1', arguments: {} });
    expect(result.isError).not.toBe(true);
    await client.close();
    await server.close();
  });
});
