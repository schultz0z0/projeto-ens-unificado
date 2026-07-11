import { authorize } from '../auth/permissions.js';
import { withActorTransaction } from '../db/actorTransaction.js';
import { appError } from '../errors.js';
import type { CommandContext } from './context.js';

export interface CampaignFilters {
  status?: string;
  courseSlug?: string;
  ownerId?: string;
  updatedFrom?: string;
  updatedTo?: string;
  cursor?: string;
  limit: number;
}

interface CampaignCursor { updatedAt: string; id: string }

function encodeCursor(cursor: CampaignCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value?: string): CampaignCursor | undefined {
  if (!value) return undefined;
  try {
    const candidate = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CampaignCursor>;
    if (typeof candidate.updatedAt !== 'string' || !Number.isFinite(Date.parse(candidate.updatedAt)) ||
        typeof candidate.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(candidate.id)) {
      throw new Error('invalid cursor');
    }
    return { updatedAt: candidate.updatedAt, id: candidate.id };
  } catch {
    throw appError('validation_error', 400, 'Campaign cursor is invalid');
  }
}

export async function listCampaigns(context: CommandContext, filters: CampaignFilters) {
  authorize(context.actor, 'campaign.read');
  const cursor = decodeCursor(filters.cursor);
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query(`
      select id, tenant_id as "tenantId", name, course_slug as "courseSlug", status::text, version::int,
        created_by as "createdBy", updated_by as "updatedBy", created_at as "createdAt",
        updated_at as "updatedAt", archived_at as "archivedAt"
      from marketing_ops.campaigns
      where ($1::text is null or status::text = $1)
        and ($2::text is null or course_slug = $2)
        and ($3::uuid is null or created_by = $3)
        and ($4::timestamptz is null or updated_at >= $4)
        and ($5::timestamptz is null or updated_at <= $5)
        and ($6::timestamptz is null or (updated_at, id) < ($6, $7::uuid))
      order by updated_at desc, id desc
      limit $8
    `, [
      filters.status ?? null, filters.courseSlug ?? null, filters.ownerId ?? null,
      filters.updatedFrom ?? null, filters.updatedTo ?? null,
      cursor?.updatedAt ?? null, cursor?.id ?? null, filters.limit + 1
    ]);
    const hasNextPage = result.rows.length > filters.limit;
    const data = result.rows.slice(0, filters.limit);
    const last = data.at(-1) as { updatedAt: Date | string; id: string } | undefined;
    return {
      data,
      nextCursor: hasNextPage && last
        ? encodeCursor({ updatedAt: new Date(last.updatedAt).toISOString(), id: last.id })
        : null
    };
  });
}

export async function getCampaign(context: CommandContext, id: string) {
  authorize(context.actor, 'campaign.read');
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query(`
      select id, tenant_id as "tenantId", name, course_slug as "courseSlug", status::text, version::int,
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
