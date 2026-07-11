import type { PoolClient } from 'pg';
import type { CommandContext } from './context.js';

export async function writeAudit(
  client: PoolClient,
  context: CommandContext,
  entityType: string,
  entityId: string,
  action: string,
  beforeState: unknown,
  afterState: unknown
): Promise<void> {
  await client.query(`
    insert into marketing_ops.audit_events
      (tenant_id, actor_user_id, actor_role, actor_type, origin, entity_type, entity_id, action, before_state, after_state, correlation_id)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
  `, [
    context.actor.tenantId, context.actor.userId, context.actor.role,
    context.origin === 'mcp' ? 'delegated_user' : 'user', context.origin,
    entityType, entityId, action,
    beforeState === null ? null : JSON.stringify(beforeState),
    afterState === null ? null : JSON.stringify(afterState), context.correlationId
  ]);
}
