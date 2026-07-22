import { createHash, timingSafeEqual } from "node:crypto";
import { basename } from "node:path";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { PictureError } from "../errors.ts";
import type { PictureMcpDependencies } from "./mcp-server.ts";
import { createPictureMcpServer } from "./mcp-server.ts";

const uuid = z.string().uuid();
const contextSchema = z.object({
  userId: uuid,
  tenantId: z.string().regex(/^[a-z0-9-]{2,64}$/i),
  sessionId: uuid.optional(),
}).strict();

const safeEqual = (left: string, right: string) => {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return left.length === right.length && right.length > 0 && timingSafeEqual(leftHash, rightHash);
};

const json = (status: number, payload: unknown, headers: HeadersInit = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});

const readJson = async (request: Request) => {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 1024 * 1024) throw new PictureError("picture_payload_too_large", "Request body is too large.", 413);
  const text = await request.text();
  if (text.length > 1024 * 1024) throw new PictureError("picture_payload_too_large", "Request body is too large.", 413);
  try { return text.trim() ? JSON.parse(text) : {}; }
  catch { throw new PictureError("picture_invalid_json", "Request body must be valid JSON.", 400); }
};

const internalContext = (request: Request, internalKey: string) => {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!safeEqual(token, internalKey)) throw new PictureError("picture_unauthorized", "Unauthorized.", 401);
  return contextSchema.parse({
    userId: request.headers.get("x-nexus-user-id") || "",
    tenantId: request.headers.get("x-nexus-tenant-id") || "",
    sessionId: request.headers.get("x-nexus-session-id") || undefined,
  });
};

export const createPictureMcpHttpHandler = (dependencies: PictureMcpDependencies) => async (request: Request) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createPictureMcpServer(dependencies);
  await server.connect(transport);
  try { return await transport.handleRequest(request); }
  finally { void transport.close(); void server.close(); }
};

export class PictureReferenceService {
  constructor(private readonly artifactClient: {
    getArtifact(id: string): Promise<Record<string, unknown>>;
    downloadArtifact(id: string): Promise<{ bytes: Uint8Array; contentType: string }>;
    uploadWorkspaceArtifact(input: Record<string, unknown>): Promise<unknown>;
  }) {}

  async importReferences(input: { ownerId: string; workspaceId: string; sessionId?: string; artifactIds: string[] }) {
    const imported = [];
    for (const artifactId of input.artifactIds) {
      const metadata = await this.artifactClient.getArtifact(artifactId);
      if (metadata.owner_id !== input.ownerId) throw new PictureError("picture_reference_not_owned", "Reference is not owned by this user.", 403);
      const downloaded = await this.artifactClient.downloadArtifact(artifactId);
      imported.push(await this.artifactClient.uploadWorkspaceArtifact({
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        relativePath: `references/${basename(String(metadata.filename || `${artifactId}.bin`))}`,
        category: "reference",
        contentType: String(metadata.content_type || downloaded.contentType),
        body: downloaded.bytes,
      }));
    }
    return imported;
  }
}

export interface PictureHttpDependencies {
  internalKey: string;
  workspaceService: {
    ensureActive(input: { tenantId: string; userId: string; chatSessionId: string; title?: string }): Promise<unknown>;
    getOwnedWorkspace(input: { tenantId: string; userId: string; workspaceId: string }): Promise<unknown>;
    approveCandidate(input: { tenantId: string; userId: string; workspaceId: string }): Promise<unknown>;
    beginReset(input: { tenantId: string; userId: string; workspaceId: string }): Promise<unknown>;
    closeAfterArtifactCleanup(input: { tenantId: string; userId: string; workspaceId: string }): Promise<unknown>;
  };
  artifactClient: { listWorkspaceArtifacts(input: { ownerId: string; workspaceId: string }): Promise<unknown> };
  referenceService: { importReferences(input: { ownerId: string; workspaceId: string; sessionId?: string; artifactIds: string[] }): Promise<unknown> };
  readiness(): Promise<boolean>;
  handleMcp(request: Request): Promise<Response>;
  allowedOrigins?: string[];
}

export const createPictureHttpHandler = (dependencies: PictureHttpDependencies) => async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const allowed = !origin || dependencies.allowedOrigins?.includes(origin);
  if (origin && !allowed) return json(403, { error: "origin_forbidden" });
  const corsHeaders: Record<string, string> = origin && allowed
    ? { "access-control-allow-origin": origin, vary: "Origin" }
    : {};
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (request.method === "GET" && url.pathname === "/health") return json(200, { ok: true }, corsHeaders);
    if (request.method === "GET" && url.pathname === "/ready") {
      const ready = await dependencies.readiness();
      return json(ready ? 200 : 503, { ready }, corsHeaders);
    }
    if (url.pathname === "/mcp") {
      if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, corsHeaders);
      return dependencies.handleMcp(request);
    }

    const context = internalContext(request, dependencies.internalKey);
    if (request.method === "POST" && url.pathname === "/internal/workspaces/ensure") {
      const body = z.object({ chat_session_id: uuid, title: z.string().trim().min(1).max(180).optional() }).strict().parse(await readJson(request));
      if (context.sessionId && context.sessionId !== body.chat_session_id) throw new PictureError("picture_session_context_mismatch", "Session context does not match.", 403);
      return json(200, { data: await dependencies.workspaceService.ensureActive({
        tenantId: context.tenantId, userId: context.userId, chatSessionId: body.chat_session_id, title: body.title,
      }) }, corsHeaders);
    }
    const match = url.pathname.match(/^\/internal\/workspaces\/([0-9a-f-]{36})(?:\/(manifest|references|approve|reset))?$/i);
    if (!match) return json(404, { error: "not_found" }, corsHeaders);
    const workspaceId = uuid.parse(match[1]);
    const action = match[2] || "";
    const scope = { tenantId: context.tenantId, userId: context.userId, workspaceId };
    if (request.method === "GET" && action === "") return json(200, { data: await dependencies.workspaceService.getOwnedWorkspace(scope) }, corsHeaders);
    if (request.method === "GET" && action === "manifest") return json(200, { data: await dependencies.artifactClient.listWorkspaceArtifacts({ ownerId: context.userId, workspaceId }) }, corsHeaders);
    if (request.method === "POST" && action === "references") {
      const body = z.object({ artifact_ids: z.array(uuid).min(1).max(20) }).strict().parse(await readJson(request));
      return json(200, { data: await dependencies.referenceService.importReferences({ ownerId: context.userId, workspaceId, sessionId: context.sessionId, artifactIds: body.artifact_ids }) }, corsHeaders);
    }
    if (request.method === "POST" && action === "approve") {
      await readJson(request);
      return json(200, { data: await dependencies.workspaceService.approveCandidate(scope) }, corsHeaders);
    }
    if (request.method === "POST" && action === "reset") {
      await readJson(request);
      await dependencies.workspaceService.beginReset(scope);
      return json(200, { data: await dependencies.workspaceService.closeAfterArtifactCleanup(scope) }, corsHeaders);
    }
    return json(405, { error: "method_not_allowed" }, corsHeaders);
  } catch (error) {
    if (error instanceof PictureError) return json(error.status, { error: error.code, message: error.message }, corsHeaders);
    if (error instanceof z.ZodError) return json(400, { error: "picture_contract_invalid", issues: error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })) }, corsHeaders);
    return json(500, { error: "picture_internal_error" }, corsHeaders);
  }
};
