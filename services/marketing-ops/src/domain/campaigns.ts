import { randomUUID } from 'node:crypto';
import { authorize } from '../auth/permissions.js';
import { withActorTransaction } from '../db/actorTransaction.js';
import { appError } from '../errors.js';
import { writeAudit } from './audit.js';
import type { CommandContext } from './context.js';
import { writeDomainEvent } from './events.js';
import { executeIdempotentCommand } from './idempotency.js';

export interface Campaign {
  id: string; tenantId: string; name: string; status: 'draft' | 'archived'; version: number;
  createdBy: string; updatedBy: string; createdAt: string; updatedAt: string; archivedAt: string | null;
}

interface CampaignRow {
  id: string; tenant_id: string; name: string; status: 'draft' | 'archived'; version: string;
  created_by: string; updated_by: string; created_at: Date; updated_at: Date; archived_at: Date | null;
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id, tenantId: row.tenant_id, name: row.name, status: row.status, version: Number(row.version),
    createdBy: row.created_by, updatedBy: row.updated_by, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(), archivedAt: row.archived_at?.toISOString() ?? null
  };
}

export async function createCampaignDraft(context: CommandContext, input: { name: string; idempotencyKey: string }): Promise<Campaign> {
  authorize(context.actor, 'campaign.create');
  const name = input.name.trim();
  if (!name) throw appError('validation_error', 400, 'Campaign name is required');
  return withActorTransaction(context.pool, context.actor, context.correlationId, (client) =>
    executeIdempotentCommand(client, context, 'campaign.create', input.idempotencyKey, { name }, async () => {
      const campaignId = randomUUID();
      await client.query(`
        insert into marketing_ops.campaigns (id, tenant_id, name, created_by, updated_by)
        values ($1, $2, $3, $4, $4)
      `, [campaignId, context.actor.tenantId, name, context.actor.userId]);
      await context.faultInjector?.('after_entity');
      await client.query(`
        insert into marketing_ops.campaign_members (tenant_id, campaign_id, user_id, member_role, created_by)
        values ($1, $2, $3, 'owner', $3)
      `, [context.actor.tenantId, campaignId, context.actor.userId]);
      const result = await client.query<CampaignRow>('select * from marketing_ops.campaigns where id = $1', [campaignId]);
      const campaign = mapCampaign(result.rows[0]!);
      await writeAudit(client, context, 'campaign', campaign.id, 'campaign.created', null, campaign);
      await writeDomainEvent(client, context, 'campaign', campaign.id, 'marketing_ops.campaign.created.v1', campaign);
      return campaign;
    })
  );
}

export async function updateCampaignDraft(
  context: CommandContext,
  id: string,
  expectedVersion: number,
  input: { name: string; idempotencyKey: string }
): Promise<Campaign> {
  authorize(context.actor, 'campaign.update');
  const name = input.name.trim();
  return withActorTransaction(context.pool, context.actor, context.correlationId, (client) =>
    executeIdempotentCommand(client, context, `campaign.update:${id}`, input.idempotencyKey, { id, expectedVersion, name }, async () => {
      const before = await client.query<CampaignRow>('select * from marketing_ops.campaigns where id = $1', [id]);
      if (!before.rows[0]) throw appError('not_found', 404, 'Campaign not found');
      const result = await client.query<CampaignRow>(`
        update marketing_ops.campaigns
        set name = $2, version = version + 1, updated_by = $3
        where id = $1 and version = $4 and status = 'draft'
        returning *
      `, [id, name, context.actor.userId, expectedVersion]);
      if (!result.rows[0]) throw appError('version_conflict', 409, 'Campaign version is stale', { currentVersion: Number(before.rows[0].version) });
      const campaign = mapCampaign(result.rows[0]);
      await writeAudit(client, context, 'campaign', id, 'campaign.updated', mapCampaign(before.rows[0]), campaign);
      await writeDomainEvent(client, context, 'campaign', id, 'marketing_ops.campaign.updated.v1', campaign);
      return campaign;
    })
  );
}

export async function archiveCampaign(context: CommandContext, id: string, expectedVersion: number, idempotencyKey: string): Promise<Campaign> {
  authorize(context.actor, 'campaign.archive');
  return withActorTransaction(context.pool, context.actor, context.correlationId, (client) =>
    executeIdempotentCommand(client, context, `campaign.archive:${id}`, idempotencyKey, { id, expectedVersion }, async () => {
      const result = await client.query<CampaignRow>(`
        update marketing_ops.campaigns set status = 'archived', archived_at = now(), version = version + 1, updated_by = $3
        where id = $1 and version = $2 and status = 'draft' returning *
      `, [id, expectedVersion, context.actor.userId]);
      if (!result.rows[0]) throw appError('version_conflict', 409, 'Campaign version is stale or campaign is archived');
      const campaign = mapCampaign(result.rows[0]);
      await writeAudit(client, context, 'campaign', id, 'campaign.archived', null, campaign);
      await writeDomainEvent(client, context, 'campaign', id, 'marketing_ops.campaign.archived.v1', campaign);
      return campaign;
    })
  );
}
