import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'pg';
import { z } from 'zod/v4';
import type { DelegationKeyring } from '../delegation/claims.js';
import { appError } from '../errors.js';
import { verifyDelegation } from '../delegation/verifier.js';
import { createCampaignDraft, updateCampaignDraft } from '../domain/campaigns.js';
import { hashCanonicalPayload } from '../domain/hash.js';
import { createCampaignItemDraft } from '../domain/items.js';
import { getCampaign, listAuditEvents, listCampaigns } from '../domain/queries.js';
import { delegationToken, idempotencyKey, uuid } from './contracts.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

export interface MarketingOpsMcpDependencies {
  pool: Pool; features: { read: boolean; write: boolean }; keyring: DelegationKeyring;
}

export function createMarketingOpsMcpServer(deps: MarketingOpsMcpDependencies): McpServer {
  const server = new McpServer({ name: 'nexus-marketing-ops', version: '1.0.0' });
  server.registerTool('marketing_ops_capabilities_v1', {
    title: 'Marketing Ops capabilities', description: 'Returns contract version and active feature flags.', inputSchema: {}
  }, async () => jsonToolResult({ contractVersion: 1, features: deps.features, delegationRequiredForDomain: true }));

  server.registerTool('marketing_ops_list_campaigns_v1', {
    title: 'List campaigns', description: 'Lists campaigns visible to the delegated actor.',
    inputSchema: {
      delegation_token: delegationToken,
      status: z.enum(['draft', 'archived']).optional(),
      course_slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/).optional(),
      owner_id: uuid.optional(),
      updated_from: z.iso.datetime({ offset: true }).optional(),
      updated_to: z.iso.datetime({ offset: true }).optional(),
      cursor: z.string().min(1).max(1024).optional(),
      limit: z.number().int().min(1).max(100).default(25)
    }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const actor = await verifyDelegation(input.delegation_token, ['campaign:read'], deps);
      const result = await listCampaigns({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, {
        limit: input.limit,
        ...(input.status ? { status: input.status } : {}),
        ...(input.course_slug ? { courseSlug: input.course_slug } : {}),
        ...(input.owner_id ? { ownerId: input.owner_id } : {}),
        ...(input.updated_from ? { updatedFrom: input.updated_from } : {}),
        ...(input.updated_to ? { updatedTo: input.updated_to } : {}),
        ...(input.cursor ? { cursor: input.cursor } : {})
      });
      return jsonToolResult(result);
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_get_campaign_v1', {
    title: 'Get campaign', description: 'Gets one campaign visible to the delegated actor.',
    inputSchema: { delegation_token: delegationToken, campaign_id: uuid }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const actor = await verifyDelegation(input.delegation_token, ['campaign:read'], deps);
      return jsonToolResult({ data: await getCampaign({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, input.campaign_id) });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_create_campaign_draft_v1', {
    title: 'Create campaign draft', description: 'Creates an idempotent campaign draft for the delegated actor.',
    inputSchema: {
      delegation_token: delegationToken,
      idempotency_key: idempotencyKey,
      name: z.string().min(1).max(200),
      course_slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/).optional()
    }
  }, async (input) => {
    try {
      if (!deps.features.write) throw appError('feature_disabled', 503, 'Feature write is disabled');
      const payload = { name: input.name, ...(input.course_slug ? { courseSlug: input.course_slug } : {}) };
      const actor = await verifyDelegation(input.delegation_token, ['campaign:write'], {
        ...deps, operation: { name: 'campaign.create', idempotencyKey: input.idempotency_key, requestHash: hashCanonicalPayload(payload) }
      });
      return jsonToolResult({ data: await createCampaignDraft({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, { ...payload, idempotencyKey: input.idempotency_key }) });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_update_campaign_draft_v1', {
    title: 'Update campaign draft', description: 'Updates a draft with optimistic concurrency.',
    inputSchema: { delegation_token: delegationToken, idempotency_key: idempotencyKey, campaign_id: uuid, expected_version: z.number().int().positive(), name: z.string().min(1).max(200) }
  }, async (input) => {
    try {
      if (!deps.features.write) throw appError('feature_disabled', 503, 'Feature write is disabled');
      const payload = { campaignId: input.campaign_id, expectedVersion: input.expected_version, name: input.name };
      const actor = await verifyDelegation(input.delegation_token, ['campaign:write'], {
        ...deps, operation: { name: `campaign.update:${input.campaign_id}`, idempotencyKey: input.idempotency_key, requestHash: hashCanonicalPayload(payload) }
      });
      return jsonToolResult({ data: await updateCampaignDraft({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, input.campaign_id, input.expected_version, { name: input.name, idempotencyKey: input.idempotency_key }) });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_create_campaign_item_draft_v1', {
    title: 'Create campaign item draft', description: 'Creates a campaign item draft.',
    inputSchema: { delegation_token: delegationToken, idempotency_key: idempotencyKey, campaign_id: uuid, kind: z.string().min(1).max(80), title: z.string().max(200).optional(), content: z.unknown() }
  }, async (input) => {
    try {
      if (!deps.features.write) throw appError('feature_disabled', 503, 'Feature write is disabled');
      const payload = { campaignId: input.campaign_id, kind: input.kind, title: input.title, content: input.content };
      const actor = await verifyDelegation(input.delegation_token, ['item:write'], {
        ...deps, operation: { name: `item.create:${input.campaign_id}`, idempotencyKey: input.idempotency_key, requestHash: hashCanonicalPayload(payload) }
      });
      return jsonToolResult({ data: await createCampaignItemDraft({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, input.campaign_id, {
        kind: input.kind, content: input.content, idempotencyKey: input.idempotency_key, ...(input.title ? { title: input.title } : {})
      }) });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_list_audit_events_v1', {
    title: 'List audit events', description: 'Lists tenant audit events for manager/admin actors.',
    inputSchema: { delegation_token: delegationToken, limit: z.number().int().min(1).max(100).default(25) }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const actor = await verifyDelegation(input.delegation_token, ['audit:read'], deps);
      return jsonToolResult({ data: await listAuditEvents({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, input.limit) });
    } catch (error) { return errorToolResult(error); }
  });
  return server;
}
