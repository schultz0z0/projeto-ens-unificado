import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { AppError, appError, errorEnvelope } from '../errors.js';
import type { Logger } from '../observability/logger.js';
import type { MetricsRegistry } from '../observability/metrics.js';

export interface AppDependencies {
  readiness: () => Promise<boolean>;
  logger: Logger;
  metrics: MetricsRegistry;
  internalKey?: string;
  outboxDepth?: () => Promise<number>;
  rateLimit?: { max: number; windowMs: number };
  router?: Router;
}

declare global {
  namespace Express {
    interface Request { correlationId: string }
  }
}

export function createApp(deps: AppDependencies) {
  const app = express();
  const clients = new Map<string, { count: number; resetAt: number }>();
  const rateLimit = deps.rateLimit ?? { max: 120, windowMs: 60_000 };
  app.disable('x-powered-by');
  // Production traffic arrives through one trusted Traefik hop.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    const supplied = request.header('x-correlation-id')?.trim();
    request.correlationId = supplied && supplied.length <= 128 ? supplied : randomUUID();
    response.setHeader('X-Correlation-Id', request.correlationId);
    response.on('finish', () => {
      const labels = { route: request.route?.path ?? request.path, status: String(response.statusCode) };
      deps.metrics.increment('marketing_ops_requests_total', labels);
      deps.metrics.increment('marketing_ops_request_duration_seconds_count', labels);
      deps.metrics.increment(
        'marketing_ops_request_duration_seconds_sum',
        labels,
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
      );
    });
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    if (clients.size > 10_000) {
      for (const [client, entry] of clients) if (entry.resetAt <= now) clients.delete(client);
    }
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const previous = clients.get(key);
    const entry = !previous || previous.resetAt <= now
      ? { count: 1, resetAt: now + rateLimit.windowMs }
      : { count: previous.count + 1, resetAt: previous.resetAt };
    clients.set(key, entry);
    response.setHeader('RateLimit-Limit', String(rateLimit.max));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, rateLimit.max - entry.count)));
    if (entry.count > rateLimit.max) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return next(appError('rate_limited', 429, 'Too many requests'));
    }
    next();
  });
  app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'marketing-ops' }));
  app.get('/ready', async (_request, response, next) => {
    try {
      const ready = await deps.readiness();
      response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
    } catch (error) {
      next(appError('dependency_unavailable', 503, 'Database is unavailable'));
    }
  });
  if (deps.internalKey) {
    app.get('/metrics', async (request, response, next) => {
      if (request.header('x-internal-key') !== deps.internalKey) {
        return next(appError('unauthorized', 401, 'A valid internal key is required'));
      }
      try {
        if (deps.outboxDepth) deps.metrics.set('marketing_ops_outbox_unpublished', await deps.outboxDepth());
        response.type('text/plain; version=0.0.4').send(deps.metrics.render());
      } catch {
        next(appError('dependency_unavailable', 503, 'Metrics dependency is unavailable'));
      }
    });
  }
  if (deps.router) app.use(deps.router);
  app.use((_request, _response, next) => next(appError('not_found', 404, 'Route not found')));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const normalized = error instanceof AppError
      ? error
      : error instanceof Error && error.name === 'ZodError'
        ? appError('validation_error', 400, 'Request validation failed')
        : appError('internal_error', 500, 'Internal server error');
    deps.metrics.increment('marketing_ops_errors_total', { code: normalized.code, status: String(normalized.status) });
    if (normalized.status >= 500) deps.logger.error(normalized.message, { correlationId: request.correlationId, error });
    response.status(normalized.status).json(errorEnvelope(normalized, request.correlationId));
  });
  return app;
}
