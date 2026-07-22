import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PictureError } from "../errors.ts";
import { CompositionPlanSchema, CreativeBriefSchema } from "./contracts.ts";
import { verifyPictureDelegation, type PictureDelegationKeyring } from "./delegation.ts";

const uuid = z.string().uuid();
const delegationToken = z.string().min(20).max(8_192);
const idempotencyKey = z.string().trim().min(1).max(180);

const toolResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

const toolError = (error: unknown) => {
  const pictureError = error instanceof PictureError
    ? error
    : new PictureError("picture_internal_error", "Picture request failed.", 500);
  return {
    ...toolResult({ error: { code: pictureError.code, message: pictureError.message } }),
    isError: true,
  };
};

export interface PictureMcpDependencies {
  keyring: PictureDelegationKeyring;
  refreshDelegation?: (token: string) => Promise<string>;
  workspaceService: {
    getOwnedWorkspace(input: { tenantId: string; userId: string; workspaceId: string }): Promise<unknown>;
  };
  jobService: {
    enqueue(input: Record<string, unknown>): Promise<unknown>;
  };
  jobReader: {
    getOwnedJob(input: { tenantId: string; userId: string; workspaceId: string; jobId: string }): Promise<unknown>;
  };
}

export const createPictureMcpServer = (dependencies: PictureMcpDependencies) => {
  const server = new McpServer({ name: "nexus-picture", version: "1.0.0" });

  server.registerTool("picture_get_workspace", {
    title: "Get Picture workspace",
    description: "Returns the current persistent Picture-Hermes workspace and its rendering state.",
    inputSchema: { delegation_token: delegationToken, workspace_id: uuid },
  }, async (input) => {
    try {
      const actor = await verifyPictureDelegation(input.delegation_token, ["picture:read"], {
        keyring: dependencies.keyring,
        workspaceId: input.workspace_id,
        refreshDelegation: dependencies.refreshDelegation,
      });
      return toolResult({ data: await dependencies.workspaceService.getOwnedWorkspace({
        tenantId: actor.tenantId,
        userId: actor.userId,
        workspaceId: actor.workspaceId,
      }) });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("picture_start_job", {
    title: "Start Picture generation",
    description: "Queues a complete Picture work package from an approved creative brief and composition plan.",
    inputSchema: {
      delegation_token: delegationToken,
      workspace_id: uuid,
      creative_brief: CreativeBriefSchema,
      composition_plan: CompositionPlanSchema,
      reference_artifact_ids: z.array(uuid).max(20).default([]),
      idempotency_key: idempotencyKey,
    },
  }, async (input) => {
    try {
      const actor = await verifyPictureDelegation(input.delegation_token, ["picture:write"], {
        keyring: dependencies.keyring,
        workspaceId: input.workspace_id,
        refreshDelegation: dependencies.refreshDelegation,
      });
      const job = await dependencies.jobService.enqueue({
        workspaceId: actor.workspaceId,
        tenantId: actor.tenantId,
        userId: actor.userId,
        kind: "generate",
        idempotencyKey: input.idempotency_key,
        specification: {
          owner_id: actor.userId,
          session_id: actor.chatSessionId,
          creative_brief: input.creative_brief,
          composition_plan: input.composition_plan,
          reference_artifact_ids: input.reference_artifact_ids,
        },
      });
      return toolResult({ data: job });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("picture_revise", {
    title: "Revise Picture candidate",
    description: "Queues a revision while preserving the previous candidate if rendering fails.",
    inputSchema: {
      delegation_token: delegationToken,
      workspace_id: uuid,
      revision_request: z.string().trim().min(1).max(5_000),
      composition_plan: CompositionPlanSchema,
      idempotency_key: idempotencyKey,
    },
  }, async (input) => {
    try {
      const actor = await verifyPictureDelegation(input.delegation_token, ["picture:write"], {
        keyring: dependencies.keyring,
        workspaceId: input.workspace_id,
        refreshDelegation: dependencies.refreshDelegation,
      });
      const job = await dependencies.jobService.enqueue({
        workspaceId: actor.workspaceId,
        tenantId: actor.tenantId,
        userId: actor.userId,
        kind: "revise",
        idempotencyKey: input.idempotency_key,
        specification: {
          owner_id: actor.userId,
          session_id: actor.chatSessionId,
          revision_request: input.revision_request,
          composition_plan: input.composition_plan,
          reference_artifact_ids: [],
        },
      });
      return toolResult({ data: job });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("picture_get_job", {
    title: "Get Picture job",
    description: "Returns a delegated rendering job without inventing completion or progress.",
    inputSchema: { delegation_token: delegationToken, workspace_id: uuid, job_id: uuid },
  }, async (input) => {
    try {
      const actor = await verifyPictureDelegation(input.delegation_token, ["picture:read"], {
        keyring: dependencies.keyring,
        workspaceId: input.workspace_id,
        refreshDelegation: dependencies.refreshDelegation,
      });
      return toolResult({ data: await dependencies.jobReader.getOwnedJob({
        tenantId: actor.tenantId,
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        jobId: input.job_id,
      }) });
    } catch (error) { return toolError(error); }
  });

  return server;
};
