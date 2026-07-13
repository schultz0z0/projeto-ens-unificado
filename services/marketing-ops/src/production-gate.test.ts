import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMarketingOpsMcpServer } from './mcp/createServer.js';

const pool = new pg.Pool({
  connectionString: process.env.MARKETING_OPS_TEST_DATABASE_URL
    ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});
const activeKey = 'active-local-delegation-key-at-least-32-bytes';
const keyring = {
  activeKid: 'v2', activeKey,
  issuer: 'nexus-chat-bridge', audience: 'nexus-marketing-ops', maxTtlSeconds: 120
};
const tenantEns = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantOther = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const users = {
  member: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333'
} as const;

const server = createMarketingOpsMcpServer({
  pool, features: { read: true, write: true }, keyring
});
const client = new Client({ name: 'phase-1-production-gate', version: '1.0.0' });

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
  await server.close();
  await pool.end();
});

async function delegation(
  role: keyof typeof users,
  scopes: string[],
  tenantId = tenantEns,
  options: { chatSessionId?: string; jti?: string; confirmationIntent?: boolean } = {}
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    tenant_id: tenantId,
    actor_role: role,
    scopes,
    chat_session_id: options.chatSessionId ?? randomUUID(),
    run_id: randomUUID(),
    correlation_id: randomUUID(),
    confirmation_intent: options.confirmationIntent === true,
    contract_version: 1
  })
    .setProtectedHeader({ alg: 'HS256', kid: 'v2' })
    .setIssuer('nexus-chat-bridge')
    .setAudience('nexus-marketing-ops')
    .setSubject(users[role])
    .setJti(options.jti ?? randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 1)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(activeKey));
}

async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  if (content[0]?.type !== 'text' || typeof content[0].text !== 'string') {
    throw new Error(`Tool ${name} did not return text content`);
  }
  const text = content[0].text;
  return { result, payload: JSON.parse(text) };
}

describe('Phase 1 production manual tests 15-20', () => {
  it('requires a later explicit confirmation for one conversational multi-action plan', async () => {
    const chatSessionId = randomUUID();
    const campaignName = `Plano conversacional local ${randomUUID()}`;
    const preparation = await delegation(
      'member',
      ['campaign:read', 'campaign:write', 'item:write'],
      tenantEns,
      { chatSessionId, jti: randomUUID() }
    );
    const prepared = await call('marketing_ops_prepare_plan_v1', {
      delegation_token: preparation,
      actions: [
        { type: 'campaign.create_draft', ref: 'campaign-main', name: campaignName },
        {
          type: 'campaign_item.create_draft', campaign_ref: 'campaign-main', kind: 'email',
          title: 'Email conversacional', content: { text: 'Conteudo confirmado' }
        }
      ]
    });
    expect(prepared.payload).toMatchObject({ persisted: false, confirmation_required: true });
    const before = await pool.query('select count(*)::int as count from marketing_ops.campaigns where name = $1', [campaignName]);
    expect(before.rows[0].count).toBe(0);

    const confirmed = await delegation(
      'member',
      ['campaign:read', 'campaign:write', 'item:write'],
      tenantEns,
      { chatSessionId, jti: randomUUID(), confirmationIntent: true }
    );
    const executed = await call('marketing_ops_execute_plan_v1', {
      delegation_token: confirmed,
      plan_token: prepared.payload.plan_token
    });
    expect(executed.payload.data).toMatchObject({ status: 'completed' });
    expect(executed.payload.data.completed).toHaveLength(2);
  });

  it('15-16 creates an item and exposes its audit event to admin', async () => {
    const campaign = await call('marketing_ops_create_campaign_draft_v1', {
      delegation_token: await delegation('admin', ['campaign:write']),
      idempotency_key: randomUUID(),
      name: 'Local gate item campaign'
    });
    const campaignId = campaign.payload.data.id as string;

    const item = await call('marketing_ops_create_campaign_item_draft_v1', {
      delegation_token: await delegation('admin', ['item:write']),
      idempotency_key: randomUUID(),
      campaign_id: campaignId,
      kind: 'email',
      title: 'Email Teste Fase 1',
      content: 'Validacao automatizada do Marketing Ops local'
    });

    expect(item.result.isError).not.toBe(true);
    expect(item.payload.data).toMatchObject({ campaignId, kind: 'email', status: 'draft', version: 1 });

    const audit = await call('marketing_ops_list_audit_events_v1', {
      delegation_token: await delegation('admin', ['audit:read']),
      limit: 100
    });
    expect(audit.payload.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: campaignId, action: 'campaign.created' }),
      expect.objectContaining({ entityId: item.payload.data.id, action: 'campaign_item.created' })
    ]));
  });

  it('17 rejects a stale campaign version without applying the name', async () => {
    const created = await call('marketing_ops_create_campaign_draft_v1', {
      delegation_token: await delegation('admin', ['campaign:write']),
      idempotency_key: randomUUID(),
      name: 'Local gate version 1'
    });
    const campaignId = created.payload.data.id as string;

    const updated = await call('marketing_ops_update_campaign_draft_v1', {
      delegation_token: await delegation('admin', ['campaign:write']),
      idempotency_key: randomUUID(),
      campaign_id: campaignId,
      expected_version: 1,
      name: 'Local gate version 2'
    });
    expect(updated.payload.data.version).toBe(2);

    const stale = await call('marketing_ops_update_campaign_draft_v1', {
      delegation_token: await delegation('admin', ['campaign:write']),
      idempotency_key: randomUUID(),
      campaign_id: campaignId,
      expected_version: 1,
      name: 'NAO DEVE SER APLICADO'
    });
    expect(stale.payload.error).toMatchObject({ code: 'version_conflict', status: 409 });

    const current = await call('marketing_ops_get_campaign_v1', {
      delegation_token: await delegation('admin', ['campaign:read']),
      campaign_id: campaignId
    });
    expect(current.payload.data).toMatchObject({ name: 'Local gate version 2', version: 2 });
  });

  it('18 replays the same idempotent campaign result without duplication', async () => {
    const idempotencyKey = randomUUID();
    const args = {
      idempotency_key: idempotencyKey,
      name: `Teste Idempotencia Fase 1 local ${randomUUID()}`
    };
    const first = await call('marketing_ops_create_campaign_draft_v1', {
      ...args,
      delegation_token: await delegation('admin', ['campaign:write'])
    });
    const replay = await call('marketing_ops_create_campaign_draft_v1', {
      ...args,
      delegation_token: await delegation('admin', ['campaign:write'])
    });

    expect(replay.payload.data.id).toBe(first.payload.data.id);
    const count = await pool.query(
      'select count(*)::int as count from marketing_ops.campaigns where name = $1',
      [args.name]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('19-20 enforces audit roles and rejects a forged tenant', async () => {
    for (const role of ['admin', 'manager'] as const) {
      const allowed = await call('marketing_ops_list_audit_events_v1', {
        delegation_token: await delegation(role, ['audit:read']),
        limit: 5
      });
      expect(allowed.result.isError).not.toBe(true);
    }

    const denied = await call('marketing_ops_list_audit_events_v1', {
      delegation_token: await delegation('member', ['audit:read']),
      limit: 5
    });
    expect(denied.payload.error).toMatchObject({ code: 'forbidden', status: 403 });

    const forgedTenant = await call('marketing_ops_list_campaigns_v1', {
      delegation_token: await delegation('member', ['campaign:read'], tenantOther),
      status: 'draft',
      limit: 25
    });
    expect(forgedTenant.payload.error).toMatchObject({ code: 'tenant_forbidden', status: 403 });
  });
});
