import { z } from 'zod';
import { authorize } from '../auth/permissions.js';
import { withActorTransaction } from '../db/actorTransaction.js';
import { appError } from '../errors.js';
import { mapCampaign, type Campaign } from './campaigns.js';
import type { CommandContext } from './context.js';
import {
  CampaignChannelSchema,
  CampaignStatusSchema,
  ReferenceTypeSchema,
  type CampaignChannel,
  type CampaignStatus,
  type ReferenceType
} from './contracts.js';

export interface CampaignFilters {
  q?: string;
  status?: CampaignStatus;
  referenceType?: ReferenceType;
  referenceKey?: string;
  channel?: CampaignChannel;
  responsibleId?: string;
  periodFrom?: string;
  periodTo?: string;
  courseSlug?: string;
  ownerId?: string;
  updatedFrom?: string;
  updatedTo?: string;
  cursor?: string;
  limit: number;
}

export interface CampaignCursor {
  updatedAt: string;
  id: string;
}

export interface NormalizedCampaignFilters {
  q: string | null;
  searchPrefix: string | null;
  status: CampaignStatus | null;
  referenceType: ReferenceType | null;
  referenceKey: string | null;
  channel: CampaignChannel | null;
  responsibleId: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  courseSlug: string | null;
  ownerId: string | null;
  updatedFrom: string | null;
  updatedTo: string | null;
  cursor: CampaignCursor | null;
  limit: number;
}

const filtersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: CampaignStatusSchema.optional(),
  referenceType: ReferenceTypeSchema.optional(),
  referenceKey: z.string().trim().min(1).max(200).optional(),
  channel: CampaignChannelSchema.optional(),
  responsibleId: z.string().uuid().optional(),
  periodFrom: z.string().date().optional(),
  periodTo: z.string().date().optional(),
  courseSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/).optional(),
  ownerId: z.string().uuid().optional(),
  updatedFrom: z.string().datetime({ offset: true }).optional(),
  updatedTo: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.number().int().min(1).max(100)
}).strict().superRefine((filters, context) => {
  if (filters.periodFrom && filters.periodTo && filters.periodTo < filters.periodFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodTo'],
      message: 'Campaign periodTo cannot precede periodFrom'
    });
  }
  if (
    filters.updatedFrom &&
    filters.updatedTo &&
    Date.parse(filters.updatedTo) < Date.parse(filters.updatedFrom)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['updatedTo'],
      message: 'Campaign updatedTo cannot precede updatedFrom'
    });
  }
});

const cursorSchema = z.object({
  updatedAt: z.string().datetime({ offset: true }),
  id: z.string().uuid()
}).strict();

const escapeLikePrefix = (value: string): string => `${value
  .replace(/\\/g, '\\\\')
  .replace(/%/g, '\\%')
  .replace(/_/g, '\\_')}%`;

export function encodeCampaignCursor(cursor: CampaignCursor): string {
  return Buffer.from(JSON.stringify(cursorSchema.parse(cursor))).toString('base64url');
}

export function decodeCampaignCursor(value?: string): CampaignCursor | undefined {
  if (!value) return undefined;
  try {
    const candidate = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    return cursorSchema.parse(candidate);
  } catch {
    throw appError('validation_error', 400, 'Campaign cursor is invalid');
  }
}

export function normalizeCampaignFilters(filters: CampaignFilters): NormalizedCampaignFilters {
  const parsed = filtersSchema.parse(filters);
  const q = parsed.q || null;
  return {
    q,
    searchPrefix: q ? escapeLikePrefix(q) : null,
    status: parsed.status ?? null,
    referenceType: parsed.referenceType ?? null,
    referenceKey: parsed.referenceKey ?? null,
    channel: parsed.channel ?? null,
    responsibleId: parsed.responsibleId ?? null,
    periodFrom: parsed.periodFrom ?? null,
    periodTo: parsed.periodTo ?? null,
    courseSlug: parsed.courseSlug ?? null,
    ownerId: parsed.ownerId ?? null,
    updatedFrom: parsed.updatedFrom ?? null,
    updatedTo: parsed.updatedTo ?? null,
    cursor: decodeCampaignCursor(parsed.cursor) ?? null,
    limit: parsed.limit
  };
}

export async function listCampaigns(
  context: CommandContext,
  input: CampaignFilters
): Promise<{ data: Campaign[]; nextCursor: string | null }> {
  authorize(context.actor, 'campaign.read');
  const filters = normalizeCampaignFilters(input);
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query(`
      select campaign.*
      from marketing_ops.campaigns as campaign
      where (
          $1::text is null
          or campaign.search_vector @@ websearch_to_tsquery('simple', $1)
          or campaign.name ilike $2 escape '\\'
          or coalesce(campaign.reference_title_snapshot, '') ilike $2 escape '\\'
        )
        and ($3::text is null or campaign.status::text = $3)
        and ($4::text is null or campaign.reference_type::text = $4)
        and ($5::text is null or campaign.reference_key = $5)
        and (
          $6::text is null
          or campaign.primary_channel::text = $6
          or $6 = any(campaign.secondary_channels::text[])
        )
        and (
          $7::uuid is null
          or exists (
            select 1
            from marketing_ops.campaign_members as responsible
            where responsible.campaign_id = campaign.id
              and responsible.tenant_id = campaign.tenant_id
              and responsible.user_id = $7
              and responsible.member_role = 'owner'
          )
        )
        and ($8::date is null or campaign.ends_on >= $8)
        and ($9::date is null or campaign.starts_on <= $9)
        and ($10::text is null or campaign.course_slug = $10)
        and ($11::uuid is null or campaign.created_by = $11)
        and ($12::timestamptz is null or campaign.updated_at >= $12)
        and ($13::timestamptz is null or campaign.updated_at <= $13)
        and (
          $14::timestamptz is null
          or (campaign.updated_at, campaign.id) < ($14, $15::uuid)
        )
      order by campaign.updated_at desc, campaign.id desc
      limit $16
    `, [
      filters.q,
      filters.searchPrefix,
      filters.status,
      filters.referenceType,
      filters.referenceKey,
      filters.channel,
      filters.responsibleId,
      filters.periodFrom,
      filters.periodTo,
      filters.courseSlug,
      filters.ownerId,
      filters.updatedFrom,
      filters.updatedTo,
      filters.cursor?.updatedAt ?? null,
      filters.cursor?.id ?? null,
      filters.limit + 1
    ]);
    const rows = result.rows.map(mapCampaign);
    const hasNextPage = rows.length > filters.limit;
    const data = rows.slice(0, filters.limit);
    const last = data.at(-1);
    return {
      data,
      nextCursor: hasNextPage && last
        ? encodeCampaignCursor({ updatedAt: last.updatedAt, id: last.id })
        : null
    };
  });
}

export async function getCampaign(context: CommandContext, id: string): Promise<Campaign> {
  authorize(context.actor, 'campaign.read');
  return withActorTransaction(context.pool, context.actor, context.correlationId, async (client) => {
    const result = await client.query('select * from marketing_ops.campaigns where id = $1', [id]);
    if (!result.rows[0]) throw appError('not_found', 404, 'Campaign not found');
    return mapCampaign(result.rows[0]);
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
