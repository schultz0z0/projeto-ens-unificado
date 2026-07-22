import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'pg';
import { z } from 'zod/v4';
import type { DelegationKeyring } from '../delegation/claims.js';
import { appError } from '../errors.js';
import { consumeDelegationUse, verifyDelegation } from '../delegation/verifier.js';
import { getCampaign, listAuditEvents, listCampaigns } from '../domain/queries.js';
import { listProductionSchedule } from '../domain/queries.js';
import { listCampaignTimeline } from '../domain/timeline.js';
import { getContentAsset, listContentAssets, listContentVersions } from '../domain/content.js';
import { listItemArtifacts } from '../domain/itemArtifacts.js';
import {
  getObjectCapabilities,
  type MarketingOpsResourceType
} from '../domain/capabilities.js';
import type { ArtifactClient } from '../integrations/artifactClient.js';
import { marketingOpsPlanActionsSchema, requiredScopesForPlan } from '../plans/contracts.js';
import { executeMarketingOpsPlan } from '../plans/executor.js';
import { issueMarketingOpsPlan, verifyMarketingOpsPlan } from '../plans/token.js';
import { delegationToken, uuid } from './contracts.js';
import { createMcpRateLimiter } from './rateLimit.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

export interface MarketingOpsMcpDependencies {
  pool: Pool; features: { read: boolean; write: boolean }; keyring: DelegationKeyring;
  refreshDelegation?: (token: string) => Promise<string>;
  rateLimiter?: ReturnType<typeof createMcpRateLimiter>;
  artifactClient?: ArtifactClient;
}

export function createMarketingOpsMcpServer(deps: MarketingOpsMcpDependencies): McpServer {
  const server = new McpServer({ name: 'nexus-marketing-ops', version: '1.0.0' });
  const rateLimiter = deps.rateLimiter ?? createMcpRateLimiter();
  const itemKind = z.enum(['task', 'email', 'whatsapp', 'post', 'creative', 'review', 'milestone']);
  const itemStatus = z.enum(['draft', 'ready', 'in_review', 'completed', 'cancelled']);
  const itemPriority = z.enum(['low', 'normal', 'high', 'urgent']);
  const campaignChannel = z.enum([
    'email', 'instagram', 'linkedin', 'facebook', 'whatsapp',
    'website', 'paid_media', 'events', 'press', 'other'
  ]);
  const resourceType = z.enum(['campaign', 'campaign_item', 'content_asset']);
  const timeZone = z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
      return true;
    } catch {
      return false;
    }
  }, 'time_zone must be a valid IANA timezone');
  server.registerTool('marketing_ops_capabilities_v1', {
    title: 'Marketing Ops capabilities', description: 'Returns contract version and active feature flags.', inputSchema: {}
  }, async () => jsonToolResult({
    contractVersion: 1,
    features: deps.features,
    delegationRequiredForDomain: true,
    conversationalConfirmationRequiredForWrites: true
  }));

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
      rateLimiter.consume(actor.userId, 'marketing_ops_list_campaigns_v1', 'read');
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
      rateLimiter.consume(actor.userId, 'marketing_ops_get_campaign_v1', 'read');
      return jsonToolResult({ data: await getCampaign({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, input.campaign_id) });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_list_campaign_items_v1', {
    title: 'List campaign production items',
    description: 'Lists the canonical production schedule visible to the delegated actor.',
    inputSchema: {
      delegation_token: delegationToken,
      from: z.iso.datetime({ offset: true }),
      to: z.iso.datetime({ offset: true }),
      campaign_id: uuid.optional(),
      kind: itemKind.optional(),
      status: itemStatus.optional(),
      priority: itemPriority.optional(),
      assignee_id: uuid.optional(),
      channel: campaignChannel.optional(),
      time_zone: timeZone.optional(),
      cursor: z.string().min(1).max(1024).optional(),
      limit: z.number().int().min(1).max(100).default(25)
    }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const actor = await verifyDelegation(input.delegation_token, ['item:read'], deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_list_campaign_items_v1', 'read');
      const context = { pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' as const };
      return jsonToolResult(await listProductionSchedule(context, {
        from: input.from,
        to: input.to,
        limit: input.limit,
        ...(input.campaign_id ? { campaignId: input.campaign_id } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.assignee_id ? { assigneeId: input.assignee_id } : {}),
        ...(input.channel ? { channel: input.channel } : {}),
        ...(input.cursor ? { cursor: input.cursor } : {})
      }, input.time_zone));
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_get_campaign_timeline_v1', {
    title: 'Get campaign timeline',
    description: 'Lists safe campaign history visible to the delegated actor.',
    inputSchema: {
      delegation_token: delegationToken,
      campaign_id: uuid,
      cursor: z.string().min(1).max(1024).optional(),
      limit: z.number().int().min(1).max(100).default(25)
    }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const actor = await verifyDelegation(input.delegation_token, ['timeline:read'], deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_get_campaign_timeline_v1', 'read');
      return jsonToolResult(await listCampaignTimeline(
        { pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' },
        input.campaign_id,
        { limit: input.limit, ...(input.cursor ? { cursor: input.cursor } : {}) }
      ));
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_get_content_v1', {
    title: 'Get campaign item content',
    description: 'Gets content assets, bounded version history and linked artifacts.',
    inputSchema: {
      delegation_token: delegationToken,
      item_id: uuid.optional(),
      asset_id: uuid.optional(),
      include_versions: z.boolean().default(false),
      version_limit: z.number().int().min(1).max(20).default(5)
    }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      if (Boolean(input.item_id) === Boolean(input.asset_id)) {
        throw appError('validation_error', 400, 'Provide exactly one of item_id or asset_id');
      }
      const actor = await verifyDelegation(input.delegation_token, ['content:read'], deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_get_content_v1', 'read');
      const context = { pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' as const };
      const assets = input.item_id
        ? await listContentAssets(context, input.item_id)
        : [await getContentAsset(context, input.asset_id!)];
      const versions = input.include_versions
        ? Object.fromEntries(await Promise.all(assets.map(async (asset) => [
          asset.id,
          (await listContentVersions(context, asset.id)).slice(0, input.version_limit)
        ])))
        : {};
      const itemId = input.item_id ?? assets[0]!.itemId;
      return jsonToolResult({
        data: {
          itemId,
          assets,
          versions,
          artifacts: await listItemArtifacts(context, itemId)
        }
      });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_get_object_capabilities_v1', {
    title: 'Get object capabilities',
    description: 'Returns contextual actions allowed for one visible Marketing Ops object.',
    inputSchema: {
      delegation_token: delegationToken,
      resource_type: resourceType,
      resource_id: uuid
    }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const scope = input.resource_type === 'campaign'
        ? 'campaign:read'
        : input.resource_type === 'campaign_item'
          ? 'item:read'
          : 'content:read';
      const actor = await verifyDelegation(input.delegation_token, [scope], deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_get_object_capabilities_v1', 'read');
      return jsonToolResult({ data: await getObjectCapabilities(
        { pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' },
        input.resource_type as MarketingOpsResourceType,
        input.resource_id
      ) });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_prepare_plan_v1', {
    title: 'Prepare Marketing Ops mutation plan',
    description: 'Validates and signs an exact mutation plan without writing domain data. Present every action naturally and ask the user for one explicit confirmation before execution.',
    inputSchema: {
      delegation_token: delegationToken,
      actions: marketingOpsPlanActionsSchema
    }
  }, async (input) => {
    try {
      if (!deps.features.write) throw appError('feature_disabled', 503, 'Feature write is disabled');
      const scopes = requiredScopesForPlan(input.actions);
      const actor = await verifyDelegation(input.delegation_token, scopes, deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_prepare_plan_v1', 'prepare');
      const prepared = await issueMarketingOpsPlan(actor, input.actions, deps.keyring);
      return jsonToolResult({
        plan_token: prepared.token,
        plan: {
          id: prepared.planId,
          hash: prepared.planHash,
          expires_at: new Date(prepared.expiresAt * 1000).toISOString(),
          actions: prepared.actions
        },
        persisted: false,
        confirmation_required: true
      });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_execute_plan_v1', {
    title: 'Execute confirmed Marketing Ops plan',
    description: 'Executes only the exact signed plan from an earlier turn. Requires a fresh delegation proving one explicit user confirmation for the complete plan.',
    inputSchema: {
      delegation_token: delegationToken,
      plan_token: z.string().min(20)
    }
  }, async (input) => {
    try {
      if (!deps.features.write) throw appError('feature_disabled', 503, 'Feature write is disabled');
      const actor = await verifyDelegation(input.delegation_token, [], deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_execute_plan_v1', 'execute');
      const plan = await verifyMarketingOpsPlan(input.plan_token, actor, deps.keyring);
      const scopes = requiredScopesForPlan(plan.actions);
      if (!scopes.every((scope) => actor.scopes.includes(scope))) {
        throw appError('delegation_scope_denied', 403, 'Delegation does not grant the required plan scopes');
      }
      await consumeDelegationUse(deps.pool, actor, {
        name: `plan.execute:${plan.plan_id}`,
        idempotencyKey: plan.plan_id,
        requestHash: plan.plan_hash
      });
      const data = await executeMarketingOpsPlan({
        pool: deps.pool,
        actor,
        correlationId: actor.correlationId,
        origin: 'mcp'
      }, plan);
      return jsonToolResult({ data });
    } catch (error) { return errorToolResult(error); }
  });

  server.registerTool('marketing_ops_list_audit_events_v1', {
    title: 'List audit events', description: 'Lists tenant audit events for manager/admin actors.',
    inputSchema: { delegation_token: delegationToken, limit: z.number().int().min(1).max(100).default(25) }
  }, async (input) => {
    try {
      if (!deps.features.read) throw appError('feature_disabled', 503, 'Feature read is disabled');
      const actor = await verifyDelegation(input.delegation_token, ['audit:read'], deps);
      rateLimiter.consume(actor.userId, 'marketing_ops_list_audit_events_v1', 'read');
      return jsonToolResult({ data: await listAuditEvents({ pool: deps.pool, actor, correlationId: actor.correlationId, origin: 'mcp' }, input.limit) });
    } catch (error) { return errorToolResult(error); }
  });
  return server;
}
