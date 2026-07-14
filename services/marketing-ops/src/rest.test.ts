import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApiRouter } from './http/routes/index.js';
import { createLogger } from './observability/logger.js';
import { createMetrics } from './observability/metrics.js';
import { createApp } from './http/createApp.js';
import { parse } from 'yaml';
import { ArtifactClient } from './integrations/artifactClient.js';

const pool = new pg.Pool({ connectionString: process.env.MARKETING_OPS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres' });
afterAll(() => pool.end());

function app(features = { read: true, write: true }) {
  const router = createApiRouter({
    pool,
    corsOrigins: ['http://frontend.local'],
    features,
    artifactClient: new ArtifactClient({
      baseUrl: 'http://127.0.0.1:8095',
      internalKey: 'artifact-test-key',
      timeoutMs: 1_000
    }),
    verifyToken: async (token) => {
      if (token !== 'valid-member') throw Object.assign(new Error('bad token'), { code: 'unauthorized', status: 401 });
      return { id: '11111111-1111-4111-8111-111111111111', email: 'member@local.test' };
    }
  });
  return createApp({
    readiness: async () => true,
    logger: createLogger(() => undefined),
    metrics: createMetrics(),
    internalKey: 'test-internal-key',
    router
  });
}

describe('Marketing Ops REST v1', () => {
  it('keeps every public REST operation in the OpenAPI contract', () => {
    const document = parse(readFileSync(new URL('../openapi/marketing-ops.v1.yaml', import.meta.url), 'utf8')) as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths).sort()).toEqual([
      '/audit-events', '/campaigns', '/campaigns/{campaignId}/items',
      '/campaigns/{campaignId}/items/{itemId}', '/campaigns/{id}',
      '/campaigns/{id}/archive', '/capabilities'
    ]);
  });

  it('publishes capabilities and default-off flags', async () => {
    const response = await request(app({ read: false, write: false })).get('/v1/capabilities');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ contractVersion: 1, features: { read: false, write: false } });
  });

  it('requires authentication and an idempotency key', async () => {
    expect((await request(app()).post('/v1/campaigns').send({ name: 'No auth' })).status).toBe(401);
    const missingKey = await request(app()).post('/v1/campaigns').set('Authorization', 'Bearer valid-member').send({ name: 'No key' });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe('idempotency_key_required');
  });

  it('creates, lists and returns ETag for the same domain record', async () => {
    const created = await request(app()).post('/v1/campaigns')
      .set('Authorization', 'Bearer valid-member')
      .set('X-Tenant-Id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'REST campaign' });
    expect(created.status).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    const listed = await request(app()).get('/v1/campaigns?limit=10&status=draft')
      .set('Authorization', 'Bearer valid-member')
      .set('X-Tenant-Id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((campaign: { id: string }) => campaign.id === created.body.data.id)).toBe(true);
  });

  it('filters by course, status, owner and period with cursor pagination', async () => {
    const headers = {
      Authorization: 'Bearer valid-member',
      'X-Tenant-Id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    };
    const first = await request(app()).post('/v1/campaigns').set(headers)
      .set('Idempotency-Key', randomUUID()).send({ name: 'Course campaign one', courseSlug: 'course-one' });
    const second = await request(app()).post('/v1/campaigns').set(headers)
      .set('Idempotency-Key', randomUUID()).send({ name: 'Course campaign two', courseSlug: 'course-one' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const query = new URLSearchParams({
      course: 'course-one', status: 'draft', owner: '11111111-1111-4111-8111-111111111111',
      from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z', limit: '1'
    });
    const pageOne = await request(app()).get(`/v1/campaigns?${query}`).set(headers);
    expect(pageOne.status).toBe(200);
    expect(pageOne.body.data).toHaveLength(1);
    expect(pageOne.body.data[0]).toMatchObject({
      courseSlug: 'course-one',
      createdBy: '11111111-1111-4111-8111-111111111111'
    });
    expect(pageOne.body.page.nextCursor).toEqual(expect.any(String));

    query.set('cursor', pageOne.body.page.nextCursor);
    const pageTwo = await request(app()).get(`/v1/campaigns?${query}`).set(headers);
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data).toHaveLength(1);
    expect(pageTwo.body.data[0].id).not.toBe(pageOne.body.data[0].id);
  });

  it('maps stale If-Match to a version conflict', async () => {
    const created = await request(app()).post('/v1/campaigns')
      .set('Authorization', 'Bearer valid-member').set('Idempotency-Key', randomUUID())
      .set('X-Tenant-Id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').send({ name: 'ETag campaign' });
    const updated = await request(app()).patch(`/v1/campaigns/${created.body.data.id}`)
      .set('Authorization', 'Bearer valid-member').set('Idempotency-Key', randomUUID()).set('If-Match', '"1"')
      .set('X-Tenant-Id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').send({ name: 'Version two' });
    expect(updated.status).toBe(200);
    const stale = await request(app()).patch(`/v1/campaigns/${created.body.data.id}`)
      .set('Authorization', 'Bearer valid-member').set('Idempotency-Key', randomUUID()).set('If-Match', '"1"')
      .set('X-Tenant-Id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').send({ name: 'Stale' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('version_conflict');
  });

  it('rejects untrusted origins and disabled writes', async () => {
    const forbiddenOrigin = await request(app()).get('/v1/capabilities').set('Origin', 'https://evil.local');
    expect(forbiddenOrigin.status).toBe(403);
    const disabled = await request(app({ read: true, write: false })).post('/v1/campaigns')
      .set('Authorization', 'Bearer valid-member').set('Idempotency-Key', randomUUID()).send({ name: 'Disabled' });
    expect(disabled.status).toBe(503);
    expect(disabled.body.error.code).toBe('feature_disabled');
  });

  it('answers trusted CORS preflight without authentication', async () => {
    const response = await request(app()).options('/v1/campaigns')
      .set('Origin', 'http://frontend.local')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key,x-tenant-id');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });
});
