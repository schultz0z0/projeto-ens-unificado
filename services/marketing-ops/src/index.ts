import { createServer } from 'node:http';
import pg from 'pg';
import { loadConfig } from './config.js';
import { createApp } from './http/createApp.js';
import { createLogger } from './observability/logger.js';
import { createMetrics } from './observability/metrics.js';

const config = loadConfig(process.env);
const logger = createLogger();
const metrics = createMetrics();
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
const app = createApp({
  logger,
  metrics,
  readiness: async () => {
    await pool.query('select 1');
    return true;
  }
});
const server = createServer(app);
server.listen(config.port, '0.0.0.0', () => logger.info('marketing-ops started', { port: config.port }));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('marketing-ops stopping', { signal });
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
