import { describe, expect, test } from "bun:test";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "99999999-9999-4999-8999-999999999999";
const SESSION = "22222222-2222-4222-8222-222222222222";
const WORKSPACE = "33333333-3333-4333-8333-333333333333";
const CANDIDATE = "44444444-4444-4444-8444-444444444444";
const VALIDATED = "55555555-5555-4555-8555-555555555555";

const loadService = async () => {
  try {
    return await import("../src/service/workspace-service.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

type Workspace = {
  id: string;
  tenant_id: string;
  user_id: string;
  chat_session_id: string;
  status: "drafting" | "generating" | "review" | "validated" | "resetting" | "closed" | "failed";
  active: boolean;
  current_job_id: string | null;
  candidate_artifact_id: string | null;
  validated_artifact_id: string | null;
  validated_work_id: string | null;
  title: string;
  version: number;
};

class FakeRepository {
  sessions = new Map<string, { id: string; user_id: string; session_kind: "normal" | "picture" }>([
    [SESSION, { id: SESSION, user_id: USER, session_kind: "picture" }],
  ]);
  workspaces: Workspace[] = [];
  validatedByArtifact = new Map<string, string>();
  createCalls = 0;

  async getSession(id: string) { return this.sessions.get(id) ?? null; }
  async findActiveWorkspace(tenantId: string, userId: string) {
    return this.workspaces.find((item) => item.tenant_id === tenantId && item.user_id === userId && item.active) ?? null;
  }
  async createWorkspace(input: { tenantId: string; userId: string; chatSessionId: string; title: string }) {
    this.createCalls += 1;
    await Promise.resolve();
    const existing = this.workspaces.find((item) => item.tenant_id === input.tenantId && item.user_id === input.userId && item.active);
    if (existing) throw Object.assign(new Error("unique"), { code: "23505" });
    const workspace: Workspace = {
      id: WORKSPACE,
      tenant_id: input.tenantId,
      user_id: input.userId,
      chat_session_id: input.chatSessionId,
      status: "drafting",
      active: true,
      current_job_id: null,
      candidate_artifact_id: null,
      validated_artifact_id: null,
      validated_work_id: null,
      title: input.title,
      version: 1,
    };
    this.workspaces.push(workspace);
    return { ...workspace };
  }
  async getOwnedWorkspace(workspaceId: string, tenantId: string, userId: string) {
    return this.workspaces.find((item) => item.id === workspaceId && item.tenant_id === tenantId && item.user_id === userId) ?? null;
  }
  async setCandidate(workspaceId: string, version: number, artifactId: string) {
    const workspace = this.workspaces.find((item) => item.id === workspaceId && item.version === version);
    if (!workspace) return null;
    workspace.candidate_artifact_id = artifactId;
    workspace.status = "review";
    workspace.version += 1;
    return { ...workspace };
  }
  async approveCandidate(input: { workspaceId: string; tenantId: string; userId: string; artifactId: string; title: string; filename: string; mimeType: string; width: number; height: number }) {
    const workspace = await this.getOwnedWorkspace(input.workspaceId, input.tenantId, input.userId);
    if (!workspace) return null;
    const workId = this.validatedByArtifact.get(input.artifactId) ?? VALIDATED;
    this.validatedByArtifact.set(input.artifactId, workId);
    workspace.status = "validated";
    workspace.validated_artifact_id = input.artifactId;
    workspace.validated_work_id = workId;
    workspace.version += 1;
    return { ...workspace };
  }
  async beginReset(workspaceId: string, tenantId: string, userId: string) {
    const workspace = await this.getOwnedWorkspace(workspaceId, tenantId, userId);
    if (!workspace) return null;
    if (workspace.status === "closed" || workspace.status === "resetting") return { ...workspace };
    if (workspace.status !== "validated") return null;
    workspace.status = "resetting";
    workspace.version += 1;
    return { ...workspace };
  }
  async closeAfterArtifactCleanup(workspaceId: string, tenantId: string, userId: string) {
    const workspace = await this.getOwnedWorkspace(workspaceId, tenantId, userId);
    if (!workspace) return null;
    if (workspace.status === "closed") return { ...workspace };
    if (workspace.status !== "resetting") return null;
    workspace.status = "closed";
    workspace.active = false;
    workspace.version += 1;
    return { ...workspace };
  }
}

const makeArtifactClient = () => ({
  promoteCalls: 0,
  deleteCalls: 0,
  async getArtifact() {
    return { id: CANDIDATE, filename: "campanha.png", content_type: "image/png" };
  },
  async downloadArtifact() {
    return { bytes: Buffer.from("fake"), contentType: "image/png" };
  },
  async promoteWorkspaceArtifact() {
    this.promoteCalls += 1;
    return { id: CANDIDATE, filename: "campanha.png", content_type: "image/png", lifecycle: "validated" };
  },
  async deleteWorkspaceArtifacts() {
    this.deleteCalls += 1;
    return { deleted_count: 3 };
  },
});

const seedWorkspace = (repo: FakeRepository, overrides: Partial<Workspace> = {}) => {
  repo.workspaces.push({
    id: WORKSPACE,
    tenant_id: "ens",
    user_id: USER,
    chat_session_id: SESSION,
    status: "drafting",
    active: true,
    current_job_id: null,
    candidate_artifact_id: null,
    validated_artifact_id: null,
    validated_work_id: null,
    title: "Nova peça",
    version: 1,
    ...overrides,
  });
};

describe("WorkspaceService", () => {
  test("ensureActive reuses an existing workspace and converges under races", async () => {
    const { WorkspaceService } = await loadService();
    const repo = new FakeRepository();
    const service = new WorkspaceService({ repository: repo, artifactClient: makeArtifactClient(), imageMetadata: async () => ({ width: 1080, height: 1350 }) });
    const [first, second] = await Promise.all([
      service.ensureActive({ tenantId: "ens", userId: USER, chatSessionId: SESSION }),
      service.ensureActive({ tenantId: "ens", userId: USER, chatSessionId: SESSION }),
    ]);
    expect(first.id).toBe(WORKSPACE);
    expect(second.id).toBe(WORKSPACE);
    expect(repo.workspaces).toHaveLength(1);
    expect((await service.ensureActive({ tenantId: "ens", userId: USER, chatSessionId: SESSION })).id).toBe(WORKSPACE);
  });

  test("ensureActive requires a Picture session owned by the user", async () => {
    const { WorkspaceService } = await loadService();
    const repo = new FakeRepository();
    repo.sessions.set(SESSION, { id: SESSION, user_id: USER, session_kind: "normal" });
    const service = new WorkspaceService({ repository: repo, artifactClient: makeArtifactClient() });
    await expect(service.ensureActive({ tenantId: "ens", userId: USER, chatSessionId: SESSION })).rejects.toMatchObject({ code: "picture_session_invalid" });
    repo.sessions.set(SESSION, { id: SESSION, user_id: OTHER_USER, session_kind: "picture" });
    await expect(service.ensureActive({ tenantId: "ens", userId: USER, chatSessionId: SESSION })).rejects.toMatchObject({ code: "picture_session_invalid" });
  });

  test("approval requires a candidate and is idempotent", async () => {
    const { WorkspaceService } = await loadService();
    const repo = new FakeRepository();
    seedWorkspace(repo);
    const artifacts = makeArtifactClient();
    const service = new WorkspaceService({ repository: repo, artifactClient: artifacts, imageMetadata: async () => ({ width: 1080, height: 1350 }) });
    await expect(service.approveCandidate({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE })).rejects.toMatchObject({ code: "picture_candidate_missing" });
    await service.setCandidate({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE, artifactId: CANDIDATE });
    const first = await service.approveCandidate({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE });
    const second = await service.approveCandidate({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE });
    expect(first.validated_work_id).toBe(VALIDATED);
    expect(second.validated_work_id).toBe(VALIDATED);
    expect(repo.validatedByArtifact).toHaveLength(1);
  });

  test("reset is rejected before approval and preserves the validated artifact", async () => {
    const { WorkspaceService } = await loadService();
    const repo = new FakeRepository();
    seedWorkspace(repo);
    const artifacts = makeArtifactClient();
    const service = new WorkspaceService({ repository: repo, artifactClient: artifacts });
    await expect(service.beginReset({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE })).rejects.toMatchObject({ code: "picture_approval_required" });
    Object.assign(repo.workspaces[0]!, {
      status: "validated",
      candidate_artifact_id: CANDIDATE,
      validated_artifact_id: CANDIDATE,
      validated_work_id: VALIDATED,
    });
    await service.beginReset({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE });
    const closed = await service.closeAfterArtifactCleanup({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE });
    const repeated = await service.closeAfterArtifactCleanup({ tenantId: "ens", userId: USER, workspaceId: WORKSPACE });
    expect(closed.status).toBe("closed");
    expect(repeated.status).toBe("closed");
    expect(repeated.validated_artifact_id).toBe(CANDIDATE);
    expect(artifacts.deleteCalls).toBe(1);
  });
});
