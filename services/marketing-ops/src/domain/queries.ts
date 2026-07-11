import { authorize } from '../auth/permissions.js';
import { withActorTransaction } from '../db/actorTransaction.js';
import { appError } from '../errors.js';
import type { CommandContext } from './context.js';

export async function listCampaigns(context: CommandContext, filters: { status?: string; limit: number }) {
  authorize(context.actor, 'campaign.read');
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query(`
      select id, tenant_id as "tenantId", name, status::text, version::int,
        created_by as "createdBy", updated_by as "updatedBy", created_at as "createdAt",
        updated_at as "updatedAt", archived_at as "archivedAt"
      from marketing_ops.campaigns
      where ($1::text is null or status::text = $1)
      order by updated_at desc, id
      limit $2
    `, [filters.status ?? null, filters.limit]);
    return result.rows;
  });
}

export async function getCampaign(context: CommandContext, id: string) {
  authorize(context.actor, 'campaign.read');
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query(`
      select id, tenant_id as "tenantId", name, status::text, version::int,
        created_by as "createdBy", updated_by as "updatedBy", created_at as "createdAt",
        updated_at as "updatedAt", archived_at as "archivedAt"
      from marketing_ops.campaigns where id = $1
    `, [id]);
    if (!result.rows[0]) throw appError('not_found', 404, 'Campaign not found');
    return result.rows[0];
  });
}

export async function listAuditEvents(context: CommandContext, limit: number) {
  authorize(context.actor, 'audit.read');
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query(`
      select id, tenant_id as "tenantId", actor_user_id as "actorUserId", actor_role::text as "actorRole",
        actor_type::text as "actorType", origin::text, entity_type as "entityType", entity_id as "entityId",
        action, before_state as "before", after_state as "after", correlation_id as "correlationId", created_at as "createdAt"
      from marketing_ops.audit_events order by created_at desc, id limit $1
    `, [limit]);
    return result.rows;
  });
}
