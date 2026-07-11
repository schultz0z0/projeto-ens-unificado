import { authorize } from '../auth/permissions.js';
import { withActorTransaction } from '../db/actorTransaction.js';
import { appError } from '../errors.js';
import { writeAudit } from './audit.js';
import type { CommandContext } from './context.js';
import { writeDomainEvent } from './events.js';
import { executeIdempotentCommand } from './idempotency.js';

export interface CampaignItem {
  id: string; tenantId: string; campaignId: string; kind: string; title: string | null;
  content: unknown; status: 'draft' | 'archived'; version: number; updatedAt: string;
}
interface ItemRow {
  id: string; tenant_id: string; campaign_id: string; kind: string; title: string | null;
  content: unknown; status: 'draft' | 'archived'; version: string; updated_at: Date;
}
const mapItem = (row: ItemRow): CampaignItem => ({
  id: row.id, tenantId: row.tenant_id, campaignId: row.campaign_id, kind: row.kind,
  title: row.title, content: row.content, status: row.status, version: Number(row.version), updatedAt: row.updated_at.toISOString()
});

export async function createCampaignItemDraft(
  context: CommandContext,
  campaignId: string,
  input: { kind: string; title?: string; content: unknown; idempotencyKey: string }
): Promise<CampaignItem> {
  authorize(context.actor, 'item.create');
  return withActorTransaction(context.pool, context.actor, context.correlationId, (client) =>
    executeIdempotentCommand(client, context, `item.create:${campaignId}`, input.idempotencyKey, { campaignId, ...input, idempotencyKey: undefined }, async () => {
      const result = await client.query<ItemRow>(`
        insert into marketing_ops.campaign_items (tenant_id, campaign_id, kind, title, content, created_by, updated_by)
        values ($1, $2, $3, $4, $5::jsonb, $6, $6) returning *
      `, [context.actor.tenantId, campaignId, input.kind.trim(), input.title?.trim() || null, JSON.stringify(input.content), context.actor.userId]);
      if (!result.rows[0]) throw appError('not_found', 404, 'Campaign not found');
      const item = mapItem(result.rows[0]);
      await writeAudit(client, context, 'campaign_item', item.id, 'campaign_item.created', null, item);
      await writeDomainEvent(client, context, 'campaign_item', item.id, 'marketing_ops.campaign_item.created.v1', item);
      return item;
    })
  );
}

export async function updateCampaignItemDraft(
  context: CommandContext,
  campaignId: string,
  itemId: string,
  expectedVersion: number,
  input: { title?: string; content: unknown; idempotencyKey: string }
): Promise<CampaignItem> {
  authorize(context.actor, 'item.update');
  return withActorTransaction(context.pool, context.actor, context.correlationId, (client) =>
    executeIdempotentCommand(client, context, `item.update:${itemId}`, input.idempotencyKey, { campaignId, itemId, expectedVersion, title: input.title, content: input.content }, async () => {
      const result = await client.query<ItemRow>(`
        update marketing_ops.campaign_items
        set title = $4, content = $5::jsonb, version = version + 1, updated_by = $6
        where id = $1 and campaign_id = $2 and version = $3 and status = 'draft' returning *
      `, [itemId, campaignId, expectedVersion, input.title?.trim() || null, JSON.stringify(input.content), context.actor.userId]);
      if (!result.rows[0]) throw appError('version_conflict', 409, 'Campaign item version is stale');
      const item = mapItem(result.rows[0]);
      await writeAudit(client, context, 'campaign_item', item.id, 'campaign_item.updated', null, item);
      await writeDomainEvent(client, context, 'campaign_item', item.id, 'marketing_ops.campaign_item.updated.v1', item);
      return item;
    })
  );
}
