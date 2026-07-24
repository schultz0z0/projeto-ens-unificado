import sharp from "sharp";
import { PictureError } from "../errors.ts";
import type { ArtifactMetadata } from "./artifact-client.ts";
import type { PictureWorkspace, PictureWorkspaceRepository } from "./repositories.ts";

interface ArtifactClient {
  getArtifact(artifactId: string, signal?: AbortSignal): Promise<ArtifactMetadata>;
  downloadArtifact(artifactId: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; contentType: string }>;
  promoteWorkspaceArtifact(input: {
    artifactId: string;
    ownerId: string;
    workspaceId: string;
    signal?: AbortSignal;
  }): Promise<ArtifactMetadata>;
  deleteWorkspaceArtifacts(input: {
    ownerId: string;
    workspaceId: string;
    signal?: AbortSignal;
  }): Promise<{ deleted_count: number }>;
}

interface Scope {
  tenantId: string;
  userId: string;
  workspaceId: string;
  signal?: AbortSignal;
}

const defaultImageMetadata = async (bytes: Uint8Array) => {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) {
    throw new PictureError("picture_candidate_invalid_image", "Candidate image dimensions could not be read.", 422);
  }
  return { width: metadata.width, height: metadata.height };
};

const databaseCode = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  return String((error as { code?: unknown }).code ?? "");
};

export class WorkspaceService {
  private readonly repository: PictureWorkspaceRepository;
  private readonly artifactClient: ArtifactClient;
  private readonly imageMetadata: (bytes: Uint8Array) => Promise<{ width: number; height: number }>;

  constructor(options: {
    repository: PictureWorkspaceRepository;
    artifactClient: ArtifactClient;
    imageMetadata?: (bytes: Uint8Array) => Promise<{ width: number; height: number }>;
  }) {
    this.repository = options.repository;
    this.artifactClient = options.artifactClient;
    this.imageMetadata = options.imageMetadata ?? defaultImageMetadata;
  }

  async ensureActive(input: {
    tenantId: string;
    userId: string;
    chatSessionId: string;
    title?: string;
  }): Promise<PictureWorkspace> {
    const session = await this.repository.getSession(input.chatSessionId);
    if (!session || session.user_id !== input.userId || session.session_kind !== "picture") {
      throw new PictureError("picture_session_invalid", "A Picture workspace requires an owned Picture session.", 409);
    }
    const existing = await this.repository.findActiveWorkspace(input.tenantId, input.userId);
    if (existing) return existing;
    try {
      return await this.repository.createWorkspace({
        tenantId: input.tenantId,
        userId: input.userId,
        chatSessionId: input.chatSessionId,
        title: input.title?.trim() || "Nova peça",
      });
    } catch (error) {
      if (databaseCode(error) !== "23505") throw error;
      const winner = await this.repository.findActiveWorkspace(input.tenantId, input.userId);
      if (winner) return winner;
      throw error;
    }
  }

  async getOwnedWorkspace(input: Scope): Promise<PictureWorkspace> {
    const workspace = await this.repository.getOwnedWorkspace(input.workspaceId, input.tenantId, input.userId);
    if (!workspace) {
      throw new PictureError("picture_workspace_not_found", "Picture workspace was not found.", 404);
    }
    return workspace;
  }

  async setCandidate(input: Scope & { artifactId: string }): Promise<PictureWorkspace> {
    const workspace = await this.getOwnedWorkspace(input);
    if (!workspace.active || ["validated", "resetting", "closed"].includes(workspace.status)) {
      throw new PictureError("picture_workspace_state_conflict", "Workspace cannot accept another candidate.", 409);
    }
    if (workspace.status === "review" && workspace.candidate_artifact_id === input.artifactId) return workspace;
    const updated = await this.repository.setCandidate(workspace.id, workspace.version, input.artifactId);
    if (!updated) {
      throw new PictureError("picture_workspace_version_conflict", "Workspace changed while setting the candidate.", 409);
    }
    return updated;
  }

  async approveCandidate(input: Scope): Promise<PictureWorkspace> {
    const workspace = await this.getOwnedWorkspace(input);
    if (workspace.status === "validated" && workspace.validated_work_id) return workspace;
    if (!workspace.candidate_artifact_id) {
      throw new PictureError("picture_candidate_missing", "There is no final candidate to approve.", 409);
    }
    if (workspace.status !== "review") {
      throw new PictureError("picture_candidate_not_ready", "The final candidate is not ready for approval.", 409);
    }

    const artifact = await this.artifactClient.getArtifact(workspace.candidate_artifact_id, input.signal);
    if (artifact.workspace_id && artifact.workspace_id !== workspace.id) {
      throw new PictureError("picture_candidate_workspace_mismatch", "Candidate does not belong to this workspace.", 409);
    }
    const downloaded = await this.artifactClient.downloadArtifact(workspace.candidate_artifact_id, input.signal);
    const dimensions = await this.imageMetadata(downloaded.bytes);
    const promoted = await this.artifactClient.promoteWorkspaceArtifact({
      artifactId: workspace.candidate_artifact_id,
      ownerId: input.userId,
      workspaceId: workspace.id,
      signal: input.signal,
    });
    const approved = await this.repository.approveCandidate({
      workspaceId: workspace.id,
      tenantId: input.tenantId,
      userId: input.userId,
      artifactId: workspace.candidate_artifact_id,
      title: workspace.title,
      filename: String(promoted.filename || artifact.filename || "peca.png"),
      mimeType: String(promoted.content_type || artifact.content_type || downloaded.contentType),
      width: dimensions.width,
      height: dimensions.height,
    });
    if (!approved) {
      const latest = await this.getOwnedWorkspace(input);
      if (latest.status === "validated" && latest.validated_work_id) return latest;
      throw new PictureError("picture_approval_conflict", "Workspace changed during approval.", 409);
    }
    return approved;
  }

  async beginReset(input: Scope): Promise<PictureWorkspace> {
    const workspace = await this.getOwnedWorkspace(input);
    if (workspace.status === "closed" || workspace.status === "resetting") return workspace;
    const resetting = await this.repository.beginReset(workspace.id, input.tenantId, input.userId);
    if (!resetting) throw new PictureError("picture_reset_conflict", "Workspace changed before reset.", 409);
    return resetting;
  }

  async closeAfterArtifactCleanup(input: Scope): Promise<PictureWorkspace> {
    const workspace = await this.getOwnedWorkspace(input);
    if (workspace.status === "closed") return workspace;
    if (workspace.status !== "resetting") {
      throw new PictureError("picture_reset_not_started", "Workspace reset has not started.", 409);
    }
    await this.artifactClient.deleteWorkspaceArtifacts({
      ownerId: input.userId,
      workspaceId: workspace.id,
      signal: input.signal,
    });
    const closed = await this.repository.closeAfterArtifactCleanup(workspace.id, input.tenantId, input.userId);
    if (!closed) throw new PictureError("picture_reset_conflict", "Workspace changed during cleanup.", 409);
    return closed;
  }
}
