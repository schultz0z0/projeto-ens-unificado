import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from './auth/actor.js';
import { createCampaignDraft, updateCampaignDraft } from './domain/campaigns.js';
import { hashCanonicalPayload } from './domain/hash.js';
import { createCampaignItemDraft, updateCampaignItemDraft } from './domain/items.js';

const pool = new pg.Pool({ connectionString: process.env.MARKETING_OPS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
const actor: Actor = { userId: '11111111-1111-4111-8111-111111111111', tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenantSlug: 'ens', role: 'member' };
afterAll(() => pool.end());

function context() {
  return { pool, actor, correlationId: randomUUID(), origin: 'rest' as const };
}

describe('idempotent draft domain', () => {
  it('hashes semantically identical objects equally', () => {
    expect(hashCanonicalPayload({ b: 2, a: { y: 2, x: 1 } })).toBe(hashCanonicalPayload({ a: { x: 1, y: 2 }, b: 2 }));
  });

  it('replays the same command and rejects a divergent payload', async () => {
    const idempotencyKey = randomUUID();
    const first = await createCampaignDraft(context(), { name: 'Idempotent campaign', idempotencyKey });
    const replay = await createCampaignDraft(context(), { name: 'Idempotent campaign', idempotencyKey });
    expect(replay.id).toBe(first.id);
    await expect(createCampaignDraft(context(), { name: 'Different campaign', idempotencyKey })).rejects.toMatchObject({ code: 'idempotency_conflict' });
    const counts = await pool.query(`
      select
        (select count(*)::int from marketing_ops.campaigns where id = $1) as campaigns,
        (select count(*)::int from marketing_ops.audit_events where entity_id = $1) as audits,
        (select count(*)::int from marketing_ops.domain_events where aggregate_id = $1) as events
    `, [first.id]);
    expect(counts.rows[0]).toEqual({ campaigns: 1, audits: 1, events: 1 });
  });

  it('rejects stale versions without modifying the campaign', async () => {
    const campaign = await createCampaignDraft(context(), { name: 'Versioned campaign', idempotencyKey: randomUUID() });
    const updated = await updateCampaignDraft(context(), campaign.id, 1, { name: 'Version two', idempotencyKey: randomUUID() });
    expect(updated.version).toBe(2);
    await expect(updateCampaignDraft(context(), campaign.id, 1, { name: 'Stale write', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'version_conflict' });
    const row = await pool.query('select name, version::int from marketing_ops.campaigns where id = $1', [campaign.id]);
    expect(row.rows[0]).toMatchObject({ name: 'Version two', version: 2 });
  });

  it('creates and version-updates a campaign item', async () => {
    const campaign = await createCampaignDraft(context(), { name: 'Item campaign', idempotencyKey: randomUUID() });
    const item = await createCampaignItemDraft(context(), campaign.id, { kind: 'copy', title: 'Draft', content: { text: 'one' }, idempotencyKey: randomUUID() });
    const updated = await updateCampaignItemDraft(context(), campaign.id, item.id, 1, { title: 'Draft two', content: { text: 'two' }, idempotencyKey: randomUUID() });
    expect(updated).toMatchObject({ id: item.id, version: 2, title: 'Draft two' });
  });

  it('rolls back entity, audit, event and idempotency on an injected failure', async () => {
    const idempotencyKey = randomUUID();
    const correlationId = randomUUID();
    await expect(createCampaignDraft({
      ...context(),
      correlationId,
      faultInjector: async (point: string) => { if (point === 'after_entity') throw new Error('injected failure'); }
    }, { name: 'Atomic campaign', idempotencyKey })).rejects.toThrow('injected failure');
    const counts = await pool.query(`
      select
        (select count(*)::int from marketing_ops.campaigns where name = 'Atomic campaign') as campaigns,
        (select count(*)::int from marketing_ops.audit_events where correlation_id = $1) as audits,
        (select count(*)::int from marketing_ops.domain_events where correlation_id = $1) as events,
        (select count(*)::int from marketing_ops.idempotency_records where idempotency_key = $2) as idempotency
    `, [correlationId, idempotencyKey]);
    expect(counts.rows[0]).toEqual({ campaigns: 0, audits: 0, events: 0, idempotency: 0 });
  });
});
