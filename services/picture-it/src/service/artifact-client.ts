import { basename } from "node:path";
import { PictureError } from "../errors.ts";

type FetchLike = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

export interface ArtifactMetadata {
  id: string;
  owner_id?: string;
  session_id?: string | null;
  filename?: string;
  content_type?: string;
  size?: number;
  sha256?: string;
  source?: string;
  workspace_id?: string | null;
  relative_path?: string | null;
  category?: string | null;
  lifecycle?: string | null;
  created_at?: string;
  updated_at?: string | null;
  promoted_at?: string | null;
  content_url?: string;
  [key: string]: unknown;
}

interface ClientOptions {
  baseUrl: string;
  internalKey: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

interface RequestOptions extends RequestInit {
  signal?: AbortSignal;
}

const errorCode = (value: unknown, status: number) => {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
    : "";
  return `picture_artifact_${normalized || (status >= 500 ? "unavailable" : "request_failed")}`;
};

const safeJson = async (response: Response): Promise<Record<string, unknown> | null> => {
  try {
    const body = await response.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

export class PictureArtifactClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly internalKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ClientOptions) {
    this.baseUrl = String(options.baseUrl ?? "").trim().replace(/\/+$/, "");
    this.internalKey = String(options.internalKey ?? "").trim();
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 30_000);
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.baseUrl) {
      throw new PictureError("picture_artifact_config_invalid", "Artifact Server URL is required.", 500);
    }
    if (!this.internalKey) {
      throw new PictureError("picture_artifact_config_invalid", "Artifact Server internal key is required.", 500);
    }
  }

  private async request(path: string, options: RequestOptions = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("artifact request timeout")), this.timeoutMs);
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.internalKey}`);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await safeJson(response);
        const correlationId = response.headers.get("x-correlation-id");
        const suffix = correlationId ? ` (correlation ${correlationId})` : "";
        throw new PictureError(
          errorCode(body?.error, response.status),
          `Artifact Server request failed with status ${response.status}${suffix}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof PictureError) throw error;
      if (controller.signal.aborted) {
        throw new PictureError("picture_artifact_timeout", "Artifact Server request timed out.", 504);
      }
      throw new PictureError("picture_artifact_unavailable", "Artifact Server is unavailable.", 503, {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  async uploadWorkspaceArtifact(input: {
    ownerId: string;
    workspaceId: string;
    sessionId?: string | null;
    relativePath: string;
    category: string;
    contentType?: string;
    body: BodyInit;
    signal?: AbortSignal;
  }): Promise<ArtifactMetadata> {
    const headers = new Headers({
      "Content-Type": input.contentType || "application/octet-stream",
      "X-Nexus-Content-Type": input.contentType || "application/octet-stream",
      "X-Nexus-Filename": basename(input.relativePath),
      "X-Nexus-Owner-Id": input.ownerId,
      "X-Nexus-Workspace-Id": input.workspaceId,
      "X-Nexus-Relative-Path": input.relativePath,
      "X-Nexus-Artifact-Category": input.category,
      "X-Nexus-Artifact-Lifecycle": "workspace",
      "X-Nexus-Source": "picture-hermes",
    });
    if (input.sessionId) headers.set("X-Nexus-Session-Id", input.sessionId);
    const response = await this.request("/v1/artifacts", {
      method: "POST",
      headers,
      body: input.body,
      signal: input.signal,
    });
    return (await response.json()) as ArtifactMetadata;
  }

  async listWorkspaceArtifacts(input: {
    ownerId: string;
    workspaceId: string;
    signal?: AbortSignal;
  }): Promise<ArtifactMetadata[]> {
    const query = new URLSearchParams({ owner_id: input.ownerId });
    const response = await this.request(
      `/v1/workspaces/${encodeURIComponent(input.workspaceId)}/artifacts?${query}`,
      { signal: input.signal },
    );
    const body = await safeJson(response);
    return Array.isArray(body?.artifacts) ? body.artifacts as ArtifactMetadata[] : [];
  }

  async getArtifact(artifactId: string, signal?: AbortSignal): Promise<ArtifactMetadata> {
    const response = await this.request(`/v1/artifacts/${encodeURIComponent(artifactId)}`, { signal });
    return (await response.json()) as ArtifactMetadata;
  }

  async createAccessLink(input: {
    artifactId: string;
    ownerId: string;
    expiresInSeconds?: number;
    signal?: AbortSignal;
  }): Promise<{ url: string; expires_at: string }> {
    const response = await this.request(`/v1/artifacts/${encodeURIComponent(input.artifactId)}/access-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: input.ownerId,
        ...(input.expiresInSeconds ? { expires_in_seconds: input.expiresInSeconds } : {}),
      }),
      signal: input.signal,
    });
    return (await response.json()) as { url: string; expires_at: string };
  }

  async promoteWorkspaceArtifact(input: {
    artifactId: string;
    ownerId: string;
    workspaceId: string;
    signal?: AbortSignal;
  }): Promise<ArtifactMetadata> {
    const response = await this.request(`/v1/artifacts/${encodeURIComponent(input.artifactId)}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: input.ownerId, workspace_id: input.workspaceId }),
      signal: input.signal,
    });
    return (await response.json()) as ArtifactMetadata;
  }

  async deleteWorkspaceArtifacts(input: {
    ownerId: string;
    workspaceId: string;
    signal?: AbortSignal;
  }): Promise<{ deleted_count: number }> {
    const query = new URLSearchParams({ owner_id: input.ownerId });
    const response = await this.request(
      `/v1/workspaces/${encodeURIComponent(input.workspaceId)}/artifacts?${query}`,
      { method: "DELETE", signal: input.signal },
    );
    return (await response.json()) as { deleted_count: number };
  }

  async downloadArtifact(artifactId: string, signal?: AbortSignal): Promise<{
    bytes: Uint8Array;
    contentType: string;
  }> {
    const response = await this.request(`/v1/artifacts/${encodeURIComponent(artifactId)}/content`, { signal });
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "application/octet-stream",
    };
  }
}
