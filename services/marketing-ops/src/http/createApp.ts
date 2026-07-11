import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { AppError, appError, errorEnvelope } from '../errors.js';
import type { Logger } from '../observability/logger.js';
import type { MetricsRegistry } from '../observability/metrics.js';

export interface AppDependencies {
  readiness: () => Promise<boolean>;
  logger: Logger;
  metrics: MetricsRegistry;
}

declare global {
  namespace Express {
    interface Request { correlationId: string }
  }
}

export function createApp(deps: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const supplied = request.header('x-correlation-id')?.trim();
    request.correlationId = supplied && supplied.length <= 128 ? supplied : randomUUID();
    response.setHeader('X-Correlation-Id', request.correlationId);
    response.on('finish', () => deps.metrics.increment('marketing_ops_requests_total', {
      route: request.route?.path ?? request.path,
      status: String(response.statusCode)
    }));
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
  app.use((_request, _response, next) => next(appError('not_found', 404, 'Route not found')));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const normalized = error instanceof AppError ? error : appError('internal_error', 500, 'Internal server error');
    if (normalized.status >= 500) deps.logger.error(normalized.message, { correlationId: request.correlationId, error });
    response.status(normalized.status).json(errorEnvelope(normalized, request.correlationId));
  });
  return app;
}
