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
import { RagCourseClient } from './integrations/ragCourseClient.js';
import {
  parseCampaignCreateBody,
  parseCampaignListQuery,
  parseCampaignPatchBody,
  parseCampaignTransitionBody
} from './http/routes/campaigns.js';

const pool = new pg.Pool({ connectionString: process.env.MARKETING_OPS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres' });
afterAll(() => pool.end());

function app(features = { read: true, write: true }) {
  const router = apiRouter(features);
  return createApp({
    readiness: async () => true,
    logger: createLogger(() => undefined),
    metrics: createMetrics(),
    internalKey: 'test-internal-key',
    router
  });
}

function apiRouter(features = { read: true, write: true }) {
  return createApiRouter({
    pool,
    corsOrigins: ['http://frontend.local'],
    features,
    artifactClient: new ArtifactClient({
      baseUrl: 'http://127.0.0.1:8095',
      internalKey: 'artifact-test-key',
      timeoutMs: 1_000
    }),
    ragCourseClient: new RagCourseClient({
      endpoint: 'http://127.0.0.1:8000/mcp',
      timeoutMs: 1_000
    }),
    verifyToken: async (token) => {
      if (token !== 'valid-member') throw Object.assign(new Error('bad token'), { code: 'unauthorized', status: 401 });
      return { id: '11111111-1111-4111-8111-111111111111', email: 'member@local.test' };
    }
  });
}

describe('Marketing Ops REST v1', () => {
  it('keeps every public REST operation in the OpenAPI contract', () => {
    const document = parse(readFileSync(new URL('../openapi/marketing-ops.v1.yaml', import.meta.url), 'utf8')) as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths).sort()).toEqual([
      '/audit-events', '/campaigns',
      '/campaigns/{campaignId}/items', '/campaigns/{campaignId}/items/{itemId}',
      '/campaigns/{campaignId}/materials', '/campaigns/{campaignId}/materials/link',
      '/campaigns/{campaignId}/materials/upload',
      '/campaigns/{campaignId}/materials/{materialId}',
      '/campaigns/{campaignId}/materials/{materialId}/access-link',
      '/campaigns/{campaignId}/participant-candidates',
      '/campaigns/{campaignId}/participants',
      '/campaigns/{campaignId}/participants/{userId}',
      '/campaigns/{campaignId}/timeline', '/campaigns/{id}',
      '/campaigns/{id}/archive', '/campaigns/{id}/transitions',
      '/capabilities', '/references/courses'
    ]);
  });

  it('parses the complete strict campaign REST contract', () => {
    expect(parseCampaignListQuery({
      q: 'campanha ens',
      status: 'active',
      referenceType: 'course',
      referenceKey: 'mba-gestao',
      channel: 'email',
      responsible: '11111111-1111-4111-8111-111111111111',
      periodFrom: '2026-08-01',
      periodTo: '2026-08-31',
      limit: '50'
    })).toMatchObject({
      q: 'campanha ens',
      status: 'active',
      referenceType: 'course',
      referenceKey: 'mba-gestao',
      channel: 'email',
      responsibleId: '11111111-1111-4111-8111-111111111111',
      periodFrom: '2026-08-01',
      periodTo: '2026-08-31',
      limit: 50
    });
    expect(() => parseCampaignListQuery({ unknown: 'field' })).toThrow();
    expect(() => parseCampaignListQuery({ limit: '101' })).toThrow();

    expect(parseCampaignCreateBody({
      name: 'Campanha completa',
      objective: 'Objetivo',
      referenceType: 'product',
      referenceTitleSnapshot: 'Produto ENS',
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
      primaryChannel: 'linkedin',
      secondaryChannels: ['email'],
      briefing: 'Briefing',
      notes: null
    })).toMatchObject({ name: 'Campanha completa', primaryChannel: 'linkedin' });
    expect(parseCampaignPatchBody({ briefing: 'Novo briefing' })).toEqual({ briefing: 'Novo briefing' });
    expect(parseCampaignTransitionBody({ to: 'planned' })).toEqual({ to: 'planned' });
    expect(() => parseCampaignCreateBody({ name: 'Mass assignment', status: 'active' })).toThrow();
    expect(() => parseCampaignPatchBody({})).toThrow();
    expect(() => parseCampaignTransitionBody({ to: 'unknown' })).toThrow();
    expect(() => parseCampaignTransitionBody({ to: 'archived' })).toThrow();
  });

  it('documents required mutation headers, ETags and stable public errors', () => {
    const document = parse(readFileSync(new URL('../openapi/marketing-ops.v1.yaml', import.meta.url), 'utf8')) as {
      paths: Record<string, Record<string, { parameters?: Array<{ $ref?: string }>; responses?: Record<string, { headers?: Record<string, unknown> }> }>>;
      components: { schemas: Record<string, unknown> };
    };
    const mutations = [
      ['/campaigns', 'post', false],
      ['/campaigns/{id}', 'patch', true],
      ['/campaigns/{id}/transitions', 'post', true],
      ['/campaigns/{id}/archive', 'post', true],
      ['/campaigns/{campaignId}/items', 'post', false],
      ['/campaigns/{campaignId}/items/{itemId}', 'patch', true],
      ['/campaigns/{campaignId}/participants', 'post', true],
      ['/campaigns/{campaignId}/participants/{userId}', 'patch', true],
      ['/campaigns/{campaignId}/participants/{userId}', 'delete', true],
      ['/campaigns/{campaignId}/materials/upload', 'post', true],
      ['/campaigns/{campaignId}/materials/link', 'post', true],
      ['/campaigns/{campaignId}/materials/{materialId}', 'delete', true]
    ] as const;
    for (const [path, method, requiresVersion] of mutations) {
      const operation = document.paths[path]?.[method];
      const refs = operation?.parameters?.map((parameter) => parameter.$ref) ?? [];
      expect(refs).toContain('#/components/parameters/IdempotencyKey');
      if (requiresVersion) expect(refs).toContain('#/components/parameters/IfMatch');
      const success = operation?.responses?.['200'] ?? operation?.responses?.['201'];
      expect(success?.headers).toHaveProperty('ETag');
    }
    expect(Object.keys(document.components.schemas)).toEqual(expect.arrayContaining([
      'ErrorEnvelope', 'CampaignCreate', 'CampaignPatch', 'CampaignTransition',
      'ParticipantCreate', 'ParticipantPatch', 'MaterialLink', 'TimelinePage'
    ]));
    expect(document.components.schemas).toHaveProperty('PublicErrorCode');
  });

  it('keeps the Express router and OpenAPI operations in lockstep', () => {
    const document = parse(readFileSync(new URL('../openapi/marketing-ops.v1.yaml', import.meta.url), 'utf8')) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const documented = Object.entries(document.paths).flatMap(([path, operations]) =>
      Object.keys(operations)
        .filter((method) => ['get', 'post', 'patch', 'delete'].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`)
    ).sort();
    const stack = (apiRouter() as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
    }).stack;
    const implemented = stack.flatMap((layer) => {
      if (!layer.route) return [];
      const path = layer.route.path
        .replace(/^\/v1/, '')
        .replace(/:([^/]+)/g, '{$1}');
      return Object.entries(layer.route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => `${method.toUpperCase()} ${path}`);
    }).sort();
    expect(documented).toEqual(implemented);
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

  it('creates a complete draft and transitions it with aggregate ETags', async () => {
    const headers = {
      Authorization: 'Bearer valid-member',
      'X-Tenant-Id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    };
    const created = await request(app()).post('/v1/campaigns')
      .set(headers)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Complete REST campaign',
        objective: 'Validate the operational REST contract',
        referenceType: 'product',
        referenceTitleSnapshot: 'Nexus AI',
        startsOn: '2026-08-01',
        endsOn: '2026-08-31',
        primaryChannel: 'linkedin',
        secondaryChannels: ['email'],
        briefing: 'Internal briefing',
        notes: null
      });
    expect(created.status).toBe(201);
    const createdEtag = String(created.headers.etag);
    expect(createdEtag).toBe('"1"');
    expect(created.body.data).toMatchObject({
      status: 'draft',
      objective: 'Validate the operational REST contract',
      primaryChannel: 'linkedin'
    });

    const transitioned = await request(app())
      .post(`/v1/campaigns/${created.body.data.id}/transitions`)
      .set(headers)
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', createdEtag)
      .send({ to: 'planned' });
    expect(transitioned.status).toBe(200);
    expect(transitioned.headers.etag).toBe('"2"');
    expect(transitioned.body.data.status).toBe('planned');
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
