import { readFileSync } from 'node:fs';
import request from 'supertest';
import { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { loadConfig } from './config.js';
import { appError, errorEnvelope } from './errors.js';
import { createApp } from './http/createApp.js';
import { createLogger } from './observability/logger.js';
import { createMetrics } from './observability/metrics.js';
import { createReadinessProbe } from './observability/readiness.js';

describe('runtime foundation', () => {
  it('fails closed in production when required values are missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('rejects placeholder secrets in production', () => {
    expect(() => loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@db:5432/postgres',
      NEXUS_APP_SUPABASE_URL: 'https://app.supabase.co',
      MARKETING_OPS_INTERNAL_KEY: 'change-me',
      MARKETING_OPS_DELEGATION_ACTIVE_KID: 'v1',
      MARKETING_OPS_DELEGATION_ACTIVE_KEY: 'change-me'
    })).toThrow(/placeholder/i);
  });

  it('requires the internal delegation refresh endpoint in production', () => {
    expect(() => loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:strong-password@db:5432/postgres',
      NEXUS_APP_SUPABASE_URL: 'https://app.supabase.co',
      NEXUS_APP_SUPABASE_ANON_KEY: 'production-anon-key',
      MARKETING_OPS_INTERNAL_KEY: 'production-internal-key-at-least-32-bytes',
      MARKETING_OPS_DELEGATION_ACTIVE_KID: 'v1',
      MARKETING_OPS_DELEGATION_ACTIVE_KEY: 'production-delegation-key-at-least-32-bytes'
    })).toThrow(/MARKETING_OPS_DELEGATION_REFRESH_URL/);
  });

  it('requires Artifact and RAG integration endpoints in production', () => {
    const production = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:strong-password@db:5432/postgres',
      NEXUS_APP_SUPABASE_URL: 'https://app.supabase.co',
      NEXUS_APP_SUPABASE_ANON_KEY: 'production-anon-key',
      MARKETING_OPS_INTERNAL_KEY: 'production-internal-key-at-least-32-bytes',
      MARKETING_OPS_DELEGATION_ACTIVE_KID: 'v1',
      MARKETING_OPS_DELEGATION_ACTIVE_KEY: 'production-delegation-key-at-least-32-bytes',
      MARKETING_OPS_DELEGATION_REFRESH_URL: 'http://app-bridge:8080/internal/marketing-ops/delegations/refresh'
    };
    expect(() => loadConfig(production)).toThrow(/MARKETING_OPS_ARTIFACT_URL/);
    expect(() => loadConfig({
      ...production,
      MARKETING_OPS_ARTIFACT_URL: 'http://artifact-server:8095',
      MARKETING_OPS_ARTIFACT_INTERNAL_KEY: 'production-artifact-key-at-least-32-bytes'
    })).toThrow(/MARKETING_OPS_RAG_URL/);
  });

  it('rejects underscore-style Compose placeholder secrets in production', () => {
    expect(() => loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:strong-password@db:5432/postgres',
      NEXUS_APP_SUPABASE_URL: 'https://app.supabase.co',
      NEXUS_APP_SUPABASE_ANON_KEY: 'production-anon-key',
      MARKETING_OPS_INTERNAL_KEY: 'CHANGE_ME_STRONG_RANDOM',
      MARKETING_OPS_DELEGATION_ACTIVE_KID: 'v1',
      MARKETING_OPS_DELEGATION_ACTIVE_KEY: 'production-delegation-key-at-least-32-bytes',
      MARKETING_OPS_DELEGATION_REFRESH_URL: 'http://app-bridge:8080/internal/marketing-ops/delegations/refresh'
    })).toThrow(/MARKETING_OPS_INTERNAL_KEY.*placeholder/i);
  });

  it('provides harmless defaults only in tests', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(config.port).toBe(8091);
    expect(config.features).toEqual({ read: false, write: false });
  });

  it('uses the repository local Supabase port block outside Windows exclusions', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(config.databaseUrl).toBe('postgresql://postgres:postgres@127.0.0.1:55322/postgres');
    expect(config.supabaseUrl).toBe('http://127.0.0.1:55321');
  });

  it('configures the private Artifact Server dependency', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      MARKETING_OPS_ARTIFACT_URL: 'http://artifact-server:8095/',
      MARKETING_OPS_ARTIFACT_INTERNAL_KEY: 'artifact-internal-test-key',
      MARKETING_OPS_ARTIFACT_TIMEOUT_MS: '3500'
    });
    expect(config.artifact).toEqual({
      url: 'http://artifact-server:8095/',
      internalKey: 'artifact-internal-test-key',
      timeoutMs: 3500
    });
  });

  it('configures the read-only RAG MCP dependency', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      MARKETING_OPS_RAG_URL: 'http://rag-mcp:8000/mcp',
      MARKETING_OPS_RAG_TIMEOUT_MS: '4200'
    });
    expect(config.rag).toEqual({
      url: 'http://rag-mcp:8000/mcp',
      timeoutMs: 4200
    });
  });

  it('creates stable error envelopes', () => {
    const error = appError('forbidden', 403, 'Access denied', { permission: 'campaign.read' });
    expect(errorEnvelope(error, 'correlation-1')).toEqual({
      error: {
        code: 'forbidden',
        message: 'Access denied',
        correlationId: 'correlation-1',
        details: { permission: 'campaign.read' }
      }
    });
  });

  it('redacts secrets recursively from structured logs', () => {
    const entries: unknown[] = [];
    const logger = createLogger((entry) => entries.push(entry));
    logger.info('request', {
      authorization: 'Bearer secret',
      nested: { delegationToken: 'jwt-secret', safe: 'kept' }
    });
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries[0])).not.toContain('jwt-secret');
    expect(JSON.stringify(entries[0])).not.toContain('Bearer secret');
    expect(entries[0]).toMatchObject({ data: { authorization: '[REDACTED]', nested: { safe: 'kept' } } });
  });

  it('redacts campaign content, filenames, signed URLs and dependency payloads from logs', () => {
    const entries: unknown[] = [];
    const logger = createLogger((entry) => entries.push(entry));
    logger.info('request completed', {
      route: '/v1/campaigns/:id',
      filename: 'launch-plan.pdf',
      objective: 'sensitive objective',
      signedUrl: 'https://files.example.test/access?token=sensitive',
      ragPayload: { query: 'private course query' }
    });
    const serialized = JSON.stringify(entries[0]);
    expect(serialized).toContain('/v1/campaigns/:id');
    expect(serialized).not.toContain('launch-plan.pdf');
    expect(serialized).not.toContain('sensitive objective');
    expect(serialized).not.toContain('files.example.test');
    expect(serialized).not.toContain('private course query');
  });

  it('records counters and renders Prometheus text', () => {
    const metrics = createMetrics();
    metrics.increment('marketing_ops_requests_total', { route: '/health', status: '200' });
    metrics.increment('marketing_ops_requests_total', { route: '/health', status: '200' });
    metrics.set('marketing_ops_outbox_unpublished', 3);
    expect(metrics.render()).toContain('marketing_ops_requests_total{route="/health",status="200"} 2');
    expect(metrics.render()).toContain('marketing_ops_outbox_unpublished 3');
  });

  it('rejects metrics and labels outside the fixed-cardinality contract', () => {
    const metrics = createMetrics();
    expect(() => metrics.increment('marketing_ops_unknown_total')).toThrow(/metric/i);
    expect(() => metrics.increment('marketing_ops_dependency_requests_total', {
      dependency: 'rag',
      status: 'ok',
      tenant: 'private-tenant-id'
    })).toThrow(/label/i);
    expect(() => metrics.increment('marketing_ops_dependency_requests_total', {
      dependency: 'private-user-id',
      status: 'ok'
    })).toThrow(/dependency/i);
  });

  it('renders the phase-2 operational metric contract', () => {
    const metrics = createMetrics();
    metrics.increment('marketing_ops_campaign_mutations_total', { operation: 'create', status: 'success' });
    metrics.increment('marketing_ops_campaign_conflicts_total');
    metrics.increment('marketing_ops_dependency_requests_total', { dependency: 'rag', status: 'ok' });
    metrics.increment('marketing_ops_artifact_bytes_total', {}, 1024);
    const output = metrics.render();
    expect(output).toContain('marketing_ops_campaign_mutations_total{operation="create",status="success"} 1');
    expect(output).toContain('marketing_ops_campaign_conflicts_total 1');
    expect(output).toContain('marketing_ops_dependency_requests_total{dependency="rag",status="ok"} 1');
    expect(output).toContain('marketing_ops_artifact_bytes_total 1024');
  });

  it('serves health without dependencies and readiness through its probe', async () => {
    const readiness = vi.fn().mockResolvedValue(true);
    const app = createApp({ readiness, logger: createLogger(() => undefined), metrics: createMetrics() });
    const health = await request(app).get('/health');
    const ready = await request(app).get('/ready');
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: 'ok', service: 'marketing-ops' });
    expect(ready.status).toBe(200);
    expect(readiness).toHaveBeenCalledOnce();
  });

  it('fails readiness when any required dependency is unavailable', async () => {
    const app = createApp({
      readiness: async () => ({
        ready: false,
        checks: { database: true, artifact: false, rag: true }
      }),
      logger: createLogger(() => undefined),
      metrics: createMetrics()
    });
    const health = await request(app).get('/health');
    const ready = await request(app).get('/ready');
    expect(health.status).toBe(200);
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({
      status: 'not_ready',
      checks: { database: 'ok', artifact: 'unavailable', rag: 'ok' }
    });
  });

  it('probes database, Artifact and RAG without leaking dependency details', async () => {
    const entries: unknown[] = [];
    const metrics = createMetrics();
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(null, { status: url.includes('artifact-server') ? 503 : 200 });
    });
    const readiness = createReadinessProbe({
      checkDatabase,
      artifact: { endpoint: 'http://artifact-server:8095', timeoutMs: 1000 },
      rag: { endpoint: 'http://rag-mcp:8000/mcp', timeoutMs: 1000 },
      fetchImpl,
      metrics,
      logger: createLogger((entry) => entries.push(entry))
    });

    await expect(readiness()).resolves.toEqual({
      ready: false,
      checks: { database: true, artifact: false, rag: true }
    });
    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith('http://artifact-server:8095/health', expect.objectContaining({ method: 'GET' }));
    expect(fetchImpl).toHaveBeenCalledWith('http://rag-mcp:8000/health', expect.objectContaining({ method: 'GET' }));
    expect(metrics.render()).toContain('marketing_ops_dependency_requests_total{dependency="artifact",status="error"} 1');
    const serialized = JSON.stringify(entries);
    expect(serialized).toContain('artifact');
    expect(serialized).not.toContain('artifact-server:8095');
    expect(serialized).not.toContain('rag-mcp:8000');
  });

  it('returns and propagates a correlation id', async () => {
    const app = createApp({ readiness: async () => true, logger: createLogger(() => undefined), metrics: createMetrics() });
    const response = await request(app).get('/health').set('X-Correlation-Id', '2f6bcb89-5ef3-4d83-80c8-530fcb369773');
    expect(response.headers['x-correlation-id']).toBe('2f6bcb89-5ef3-4d83-80c8-530fcb369773');
  });

  it('writes a bounded structured request log without headers or payloads', async () => {
    const entries: Record<string, unknown>[] = [];
    const app = createApp({
      readiness: async () => true,
      logger: createLogger((entry) => entries.push(entry)),
      metrics: createMetrics()
    });
    const response = await request(app)
      .get('/health')
      .set('Authorization', 'Bearer never-log-this')
      .set('X-Correlation-Id', 'request-log-correlation');
    expect(response.status).toBe(200);
    expect(entries).toContainEqual(expect.objectContaining({
      level: 'info',
      message: 'request completed',
      data: expect.objectContaining({
        correlationId: 'request-log-correlation',
        route: '/health',
        operation: 'health',
        status: 200,
        durationMs: expect.any(Number)
      })
    }));
    expect(JSON.stringify(entries)).not.toContain('never-log-this');
  });

  it('records campaign mutations, conflicts and uploaded bytes from bounded routes', async () => {
    const metrics = createMetrics();
    const router = Router();
    router.post('/v1/campaigns', (_request, response) => response.status(201).json({ data: {} }));
    router.patch('/v1/campaigns/:id', (_request, _response, next) => next(
      appError('version_conflict', 409, 'Campaign version is stale')
    ));
    router.post('/v1/campaigns/:campaignId/materials/upload', (_request, response) => response.status(201).json({ data: {} }));
    const app = createApp({
      readiness: async () => true,
      logger: createLogger(() => undefined),
      metrics,
      router
    });

    await request(app).post('/v1/campaigns').send({ name: 'not-logged' }).expect(201);
    await request(app).patch('/v1/campaigns/11111111-1111-4111-8111-111111111111').send({ name: 'not-logged' }).expect(409);
    await request(app)
      .post('/v1/campaigns/11111111-1111-4111-8111-111111111111/materials/upload')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(16))
      .expect(201);

    const output = metrics.render();
    expect(output).toContain('marketing_ops_campaign_mutations_total{operation="create",status="success"} 1');
    expect(output).toContain('marketing_ops_campaign_mutations_total{operation="update",status="conflict"} 1');
    expect(output).toContain('marketing_ops_campaign_conflicts_total 1');
    expect(output).toContain('marketing_ops_campaign_version_conflicts_total 1');
    expect(output).toContain('marketing_ops_artifact_bytes_total 16');
    expect(output).not.toContain('11111111-1111-4111-8111-111111111111');
  });

  it('protects Prometheus metrics with the internal key', async () => {
    const app = createApp({
      readiness: async () => true,
      logger: createLogger(() => undefined),
      metrics: createMetrics(),
      internalKey: 'metrics-secret',
      outboxDepth: async () => 4
    });
    expect((await request(app).get('/metrics')).status).toBe(401);
    const response = await request(app).get('/metrics').set('X-Internal-Key', 'metrics-secret');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('marketing_ops_requests_total');
    expect(response.text).toContain('marketing_ops_outbox_unpublished 4');
  });

  it('refreshes aggregate workspace product metrics without personal labels', async () => {
    const collectWorkspaceMetrics = vi.fn().mockResolvedValue({
      campaignsCreated: 7,
      campaignsWithoutOwner: 1,
      activeUsers24h: 3,
      briefingCompletionRatio: 0.5,
      timeToPlannedSeconds: { count: 2, sum: 5400 },
      statusTransitions: [{ from: 'draft', to: 'planned', count: 2 }]
    });
    const app = createApp({
      readiness: async () => true,
      logger: createLogger(() => undefined),
      metrics: createMetrics(),
      internalKey: 'metrics-secret',
      collectWorkspaceMetrics
    });

    const response = await request(app).get('/metrics').set('X-Internal-Key', 'metrics-secret');
    expect(response.status).toBe(200);
    expect(collectWorkspaceMetrics).toHaveBeenCalledOnce();
    expect(response.text).toContain('marketing_ops_campaigns_created_total 7');
    expect(response.text).toContain('marketing_ops_campaign_status_transitions_total{from="draft",to="planned"} 2');
    expect(response.text).toContain('marketing_ops_campaigns_without_owner 1');
    expect(response.text).toContain('marketing_ops_workspace_active_users_24h 3');
    expect(response.text).toContain('marketing_ops_briefing_completion_ratio 0.5');
    expect(response.text).toContain('marketing_ops_time_to_planned_seconds_count 2');
    expect(response.text).toContain('marketing_ops_time_to_planned_seconds_sum 5400');
    expect(response.text).not.toContain('tenant');
    expect(response.text).not.toContain('user_id');
  });

  it('rate limits abusive clients with an explicit retry window', async () => {
    const app = createApp({
      readiness: async () => true,
      logger: createLogger(() => undefined),
      metrics: createMetrics(),
      rateLimit: { max: 1, windowMs: 60_000 }
    });
    expect((await request(app).get('/health')).status).toBe(200);
    const limited = await request(app).get('/health');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(limited.body.error.code).toBe('rate_limited');
  });
});

describe('production Compose contract', () => {
  it('gates Marketing Ops on composite readiness and keeps dependencies private', () => {
    const compose = parse(readFileSync(new URL('../../../docker-compose.yml', import.meta.url), 'utf8')) as {
      services: Record<string, {
        environment?: Record<string, string>;
        healthcheck?: { test?: string[] };
        depends_on?: Record<string, { condition?: string }>;
      }>;
    };
    const production = parse(readFileSync(new URL('../../../docker-compose.prod.yml', import.meta.url), 'utf8')) as {
      services: Record<string, { labels?: string[] }>;
    };
    const marketingOps = compose.services['marketing-ops'];

    expect(marketingOps?.healthcheck?.test?.join(' ')).toContain('/ready');
    expect(marketingOps?.healthcheck?.test?.join(' ')).not.toContain('/health');
    expect(marketingOps?.depends_on).toMatchObject({
      'artifact-server': { condition: 'service_healthy' },
      'rag-mcp': { condition: 'service_healthy' }
    });
    expect(marketingOps?.environment).toMatchObject({
      MARKETING_OPS_ARTIFACT_URL: '${NEXUS_ARTIFACT_INTERNAL_URL:-http://artifact-server:8095}',
      MARKETING_OPS_ARTIFACT_TIMEOUT_MS: '${NEXUS_MARKETING_OPS_ARTIFACT_TIMEOUT_MS:-5000}',
      MARKETING_OPS_RAG_URL: '${NEXUS_MARKETING_OPS_RAG_URL:-http://rag-mcp:8000/mcp}',
      MARKETING_OPS_RAG_TIMEOUT_MS: '${NEXUS_MARKETING_OPS_RAG_TIMEOUT_MS:-5000}'
    });
    expect(production.services['rag-mcp']?.labels).toContain('traefik.enable=false');
  });
});
