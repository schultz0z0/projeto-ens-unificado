import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createApp, type WorkspaceMetricsSnapshot } from './http/createApp.js';
import { createApiRouter } from './http/routes/index.js';
import { verifySupabaseBearer } from './auth/supabaseAuth.js';
import { createLogger } from './observability/logger.js';
import { createMetrics } from './observability/metrics.js';
import { createReadinessProbe } from './observability/readiness.js';
import { createDelegationRefresher } from './delegation/refresher.js';
import { ArtifactClient } from './integrations/artifactClient.js';
import { RagCourseClient } from './integrations/ragCourseClient.js';

const config = loadConfig(process.env);
const logger = createLogger();
const metrics = createMetrics();
const pool = createPool(config.databaseUrl);
const router = createApiRouter({
  pool,
  corsOrigins: config.corsOrigins,
  features: config.features,
  artifactClient: new ArtifactClient({
    baseUrl: config.artifact.url,
    internalKey: config.artifact.internalKey,
    timeoutMs: config.artifact.timeoutMs
  }),
  ragCourseClient: new RagCourseClient({
    endpoint: config.rag.url,
    timeoutMs: config.rag.timeoutMs
  }),
  tenantTimeZone: config.tenantTimeZone,
  keyring: config.delegation,
  refreshDelegation: createDelegationRefresher(config.delegationRefresh),
  verifyToken: (token) => verifySupabaseBearer(token, {
    supabaseUrl: config.supabaseUrl,
    anonKey: config.supabaseAnonKey
  })
});
const app = createApp({
  logger,
  metrics,
  internalKey: config.internalKey,
  outboxDepth: async () => {
    const result = await pool.query<{ count: string }>(
      'select count(*) from marketing_ops.domain_events where published_at is null and available_at <= now()'
    );
    return Number(result.rows[0]?.count ?? 0);
  },
  collectWorkspaceMetrics: async () => {
    const result = await pool.query<{
      campaigns_created: string;
      campaigns_without_owner: string;
      active_users_24h: string;
      briefing_completion_ratio: number;
      time_to_planned_count: string;
      time_to_planned_sum: number;
      status_transitions: WorkspaceMetricsSnapshot['statusTransitions'];
    }>(`
      with transition_events as (
        select
          aggregate_id as campaign_id,
          payload ->> 'from' as from_status,
          payload ->> 'to' as to_status,
          created_at
        from marketing_ops.domain_events
        where aggregate_type = 'campaign'
          and event_type in (
            'marketing_ops.campaign.status_changed.v1',
            'marketing_ops.campaign.archived.v1'
          )
      ),
      first_planned as (
        select campaign_id, min(created_at) as planned_at
        from transition_events
        where to_status = 'planned'
        group by campaign_id
      ),
      grouped_transitions as (
        select from_status, to_status, count(*)::int as count
        from transition_events
        group by from_status, to_status
      )
      select
        (select count(*) from marketing_ops.campaigns)::text as campaigns_created,
        (
          select count(*)
          from marketing_ops.campaigns campaign
          where not exists (
            select 1
            from marketing_ops.campaign_members participant
            where participant.campaign_id = campaign.id and participant.is_primary
          )
        )::text as campaigns_without_owner,
        (
          select count(distinct actor_user_id)
          from marketing_ops.audit_events
          where created_at >= now() - interval '24 hours'
        )::text as active_users_24h,
        coalesce((
          select avg((briefing is not null and btrim(briefing) <> '')::int)::double precision
          from marketing_ops.campaigns
          where status <> 'archived'
        ), 0) as briefing_completion_ratio,
        (select count(*) from first_planned)::text as time_to_planned_count,
        coalesce((
          select sum(greatest(extract(epoch from planned.planned_at - campaign.created_at), 0))::double precision
          from first_planned planned
          join marketing_ops.campaigns campaign on campaign.id = planned.campaign_id
        ), 0) as time_to_planned_sum,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'from', from_status,
            'to', to_status,
            'count', count
          ) order by from_status, to_status)
          from grouped_transitions
        ), '[]'::jsonb) as status_transitions
    `);
    const row = result.rows[0];
    if (!row) throw new Error('workspace metrics query returned no row');
    return {
      campaignsCreated: Number(row.campaigns_created),
      campaignsWithoutOwner: Number(row.campaigns_without_owner),
      activeUsers24h: Number(row.active_users_24h),
      briefingCompletionRatio: Number(row.briefing_completion_ratio),
      timeToPlannedSeconds: {
        count: Number(row.time_to_planned_count),
        sum: Number(row.time_to_planned_sum)
      },
      statusTransitions: row.status_transitions
    };
  },
  router,
  readiness: createReadinessProbe({
    checkDatabase: () => pool.query('select 1'),
    artifact: { endpoint: config.artifact.url, timeoutMs: config.artifact.timeoutMs },
    rag: { endpoint: config.rag.url, timeoutMs: config.rag.timeoutMs },
    metrics,
    logger
  })
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
