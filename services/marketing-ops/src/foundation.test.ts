import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';
import { appError, errorEnvelope } from './errors.js';
import { createApp } from './http/createApp.js';
import { createLogger } from './observability/logger.js';
import { createMetrics } from './observability/metrics.js';

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

  it('provides harmless defaults only in tests', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(config.port).toBe(8091);
    expect(config.features).toEqual({ read: false, write: false });
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

  it('records counters and renders Prometheus text', () => {
    const metrics = createMetrics();
    metrics.increment('marketing_ops_requests_total', { route: '/health', status: '200' });
    metrics.increment('marketing_ops_requests_total', { route: '/health', status: '200' });
    metrics.set('marketing_ops_outbox_unpublished', 3);
    expect(metrics.render()).toContain('marketing_ops_requests_total{route="/health",status="200"} 2');
    expect(metrics.render()).toContain('marketing_ops_outbox_unpublished 3');
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

  it('returns and propagates a correlation id', async () => {
    const app = createApp({ readiness: async () => true, logger: createLogger(() => undefined), metrics: createMetrics() });
    const response = await request(app).get('/health').set('X-Correlation-Id', '2f6bcb89-5ef3-4d83-80c8-530fcb369773');
    expect(response.headers['x-correlation-id']).toBe('2f6bcb89-5ef3-4d83-80c8-530fcb369773');
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
