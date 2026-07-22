import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'pg';
import { z } from 'zod/v4';
import type { DelegationKeyring } from '../delegation/claims.js';
import { appError } from '../errors.js';
import { consumeDelegationUse, verifyDelegation } from '../delegation/verifier.js';
import { getCampaign, listAuditEvents, listCampaigns } from '../domain/queries.js';
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
}

export function createMarketingOpsMcpServer(deps: MarketingOpsMcpDependencies): McpServer {
  const server = new McpServer({ name: 'nexus-marketing-ops', version: '1.0.0' });
  const rateLimiter = deps.rateLimiter ?? createMcpRateLimiter();
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
