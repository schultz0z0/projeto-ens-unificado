import { afterEach, expect, test } from "bun:test";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

import { createArtifactServer } from "../../../artifact-server/src/server.js";
import { PictureError } from "../../src/errors.ts";
import { PictureArtifactClient } from "../../src/service/artifact-client.ts";
import { createPictureHttpHandler, PictureReferenceService } from "../../src/service/http-server.ts";
import { JobService, type PictureJob } from "../../src/service/job-service.ts";
import { PicturePackageBuilder } from "../../src/service/package-builder.ts";
import { PicturePackagePublisher } from "../../src/service/package-publisher.ts";
import type { PictureWorkspace, ValidatedVisualInput } from "../../src/service/repositories.ts";
import { PictureJobExecutor, PictureWorker } from "../../src/service/worker.ts";
import { WorkspaceService } from "../../src/service/workspace-service.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const TENANT = "ens";
const INTERNAL_KEY = "picture-integration-internal-key-at-least-32-bytes";
const ARTIFACT_KEY = "artifact-integration-internal-key-at-least-32-bytes";

const creativeBrief = {
  title: "Graduação ENS",
  campaign_type: "captação",
  channel: "Instagram",
  objective: "Gerar matrículas",
  audience: "Profissionais de seguros",
  offer: "Graduação especializada",
  copy_points: ["Formação reconhecida"],
  cta: "Inscreva-se",
  visual_style: "Editorial premium",
  brand_profile: "ENS",
  output: { width: 1080, height: 1350, format: "png" as const },
};

const compositionPlan = {
  version: 1 as const,
  base_prompt: "Retrato editorial brasileiro",
  pipeline: [{ op: "generate" as const, prompt: "Retrato editorial brasileiro", size: "1080x1350" }],
  final_path: "final/peca.png",
};

class MemoryRepositories {
  sessions = new Map([[SESSION, { id: SESSION, user_id: USER, session_kind: "picture" as const }]]);
  workspaces: PictureWorkspace[] = [];
  jobs: PictureJob[] = [];
  validatedWorks: ValidatedVisualInput[] = [];
  expired = new Set<string>();

  async getSession(id: string) { return this.sessions.get(id) ?? null; }
  async findActiveWorkspace(tenantId: string, userId: string) {
    return this.workspaces.find((entry) => entry.tenant_id === tenantId && entry.user_id === userId && entry.active) ?? null;
  }
  async createWorkspace(input: { tenantId: string; userId: string; chatSessionId: string; title: string }) {
    const workspace: PictureWorkspace = {
      id: crypto.randomUUID(), tenant_id: input.tenantId, user_id: input.userId,
      chat_session_id: input.chatSessionId, status: "drafting", active: true,
      current_job_id: null, candidate_artifact_id: null, validated_artifact_id: null,
      validated_work_id: null, title: input.title, version: 1,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), closed_at: null,
    };
    this.workspaces.push(workspace);
    return { ...workspace };
  }
  async getOwnedWorkspace(workspaceId: string, tenantId: string, userId: string) {
    return this.workspaces.find((entry) => entry.id === workspaceId && entry.tenant_id === tenantId && entry.user_id === userId) ?? null;
  }
  async setCandidate(workspaceId: string, version: number, artifactId: string) {
    const workspace = this.workspaces.find((entry) => entry.id === workspaceId && entry.version === version);
    if (!workspace) return null;
    workspace.status = "review"; workspace.candidate_artifact_id = artifactId; workspace.version += 1;
    return { ...workspace };
  }
  async approveCandidate(input: ValidatedVisualInput) {
    const workspace = await this.getOwnedWorkspace(input.workspaceId, input.tenantId, input.userId);
    if (!workspace) return null;
    this.validatedWorks.push(input);
    workspace.status = "validated"; workspace.validated_artifact_id = input.artifactId;
    workspace.validated_work_id = crypto.randomUUID(); workspace.version += 1;
    return { ...workspace };
  }
  async beginReset(workspaceId: string, tenantId: string, userId: string) {
    const workspace = await this.getOwnedWorkspace(workspaceId, tenantId, userId);
    if (!workspace || workspace.status !== "validated") return null;
    workspace.status = "resetting"; workspace.version += 1;
    return { ...workspace };
  }
  async closeAfterArtifactCleanup(workspaceId: string, tenantId: string, userId: string) {
    const workspace = await this.getOwnedWorkspace(workspaceId, tenantId, userId);
    if (!workspace || workspace.status !== "resetting") return null;
    workspace.status = "closed"; workspace.active = false; workspace.closed_at = new Date().toISOString(); workspace.version += 1;
    return { ...workspace };
  }

  async enqueue(input: {
    workspaceId: string; tenantId: string; userId: string; kind: "generate" | "revise";
    idempotencyKey: string; specification: Record<string, unknown>; maxAttempts: number;
  }) {
    const duplicate = this.jobs.find((entry) => entry.workspace_id === input.workspaceId && entry.idempotency_key === input.idempotencyKey);
    if (duplicate) return duplicate;
    if (this.jobs.some((entry) => entry.workspace_id === input.workspaceId && ["queued", "running"].includes(entry.status))) {
      throw Object.assign(new Error("active"), { code: "picture_job_active" });
    }
    const workspace = await this.getOwnedWorkspace(input.workspaceId, input.tenantId, input.userId);
    if (!workspace?.active) return null;
    const job: PictureJob = {
      id: crypto.randomUUID(), workspace_id: input.workspaceId, kind: input.kind, status: "queued",
      idempotency_key: input.idempotencyKey, specification: input.specification, progress: 0,
      attempt_count: 0, max_attempts: input.maxAttempts, lease_owner: null,
      lease_expires_at: null, result_artifact_id: null,
    };
    this.jobs.push(job); workspace.status = "generating"; workspace.current_job_id = job.id;
    return job;
  }
  async claim(workerId: string, leaseSeconds: number) {
    const job = this.jobs.find((entry) => entry.status === "queued" || (entry.status === "running" && this.expired.has(entry.id) && entry.attempt_count < entry.max_attempts));
    if (!job) return null;
    this.expired.delete(job.id); job.status = "running"; job.attempt_count += 1; job.lease_owner = workerId;
    job.lease_expires_at = new Date(Date.now() + leaseSeconds * 1_000).toISOString();
    return { ...job };
  }
  async heartbeat(jobId: string, workerId: string, leaseSeconds: number) {
    const job = this.jobs.find((entry) => entry.id === jobId && entry.status === "running" && entry.lease_owner === workerId);
    if (!job) return null;
    job.lease_expires_at = new Date(Date.now() + leaseSeconds * 1_000).toISOString();
    return { ...job };
  }
  async complete(input: { jobId: string; workerId: string; resultArtifactId: string }) {
    const job = this.jobs.find((entry) => entry.id === input.jobId && entry.status === "running" && entry.lease_owner === input.workerId);
    if (!job) return null;
    job.status = "succeeded"; job.progress = 100; job.result_artifact_id = input.resultArtifactId;
    job.lease_owner = null; job.lease_expires_at = null;
    const workspace = this.workspaces.find((entry) => entry.id === job.workspace_id)!;
    workspace.status = "review"; workspace.candidate_artifact_id = input.resultArtifactId; workspace.current_job_id = null;
    return { ...job };
  }
  async fail(input: { jobId: string; workerId: string; errorCode: string; errorMessage: string; retryable: boolean }) {
    const job = this.jobs.find((entry) => entry.id === input.jobId && entry.status === "running" && entry.lease_owner === input.workerId);
    if (!job) return null;
    job.status = input.retryable && job.attempt_count < job.max_attempts ? "queued" : "failed";
    job.error_code = input.errorCode; job.error_message = input.errorMessage; job.lease_owner = null; job.lease_expires_at = null;
    return { ...job };
  }
  expireLease(jobId: string) { this.expired.add(jobId); }
}

type Harness = {
  root: string;
  artifactServer: ReturnType<typeof createArtifactServer>;
  pictureServer: ReturnType<typeof Bun.serve>;
  artifactClient: PictureArtifactClient;
  repositories: MemoryRepositories;
  workspaceService: WorkspaceService;
  jobService: JobService;
  executor: PictureJobExecutor;
  request: (path: string, method?: string, body?: unknown) => Promise<any>;
};
const harnesses: Harness[] = [];

const createHarness = async (): Promise<Harness> => {
  const root = await mkdtemp(join(tmpdir(), "picture-workspace-flow-"));
  const artifactData = join(root, "artifacts");
  const packageTemp = join(root, "packages");
  await Promise.all([mkdir(artifactData), mkdir(packageTemp)]);
  const artifactServer = createArtifactServer({
    dataDir: artifactData,
    internalKey: ARTIFACT_KEY,
    accessTokenSecret: "integration-access-token-secret-at-least-32-bytes",
    publicBaseUrl: "http://127.0.0.1",
  });
  artifactServer.listen(0, "127.0.0.1");
  await once(artifactServer, "listening");
  const address = artifactServer.address();
  if (!address || typeof address === "string") throw new Error("artifact_test_server_missing");
  const artifactUrl = `http://127.0.0.1:${address.port}`;
  const artifactClient = new PictureArtifactClient({ baseUrl: artifactUrl, internalKey: ARTIFACT_KEY });
  const repositories = new MemoryRepositories();
  const workspaceService = new WorkspaceService({
    repository: repositories,
    artifactClient,
    imageMetadata: async () => ({ width: 32, height: 32 }),
  });
  const jobService = new JobService({ repository: repositories, leaseSeconds: 5, maxAttempts: 3 });
  const executor = new PictureJobExecutor({
    artifactClient,
    packageBuilder: new PicturePackageBuilder({ artifactClient, tempRoot: packageTemp }),
    engine: {
      async execute(input: Record<string, unknown>) {
        await sharp({ create: { width: 32, height: 32, channels: 4, background: "#00a7b5" } })
          .png().toFile(String(input.finalPath));
        return String(input.finalPath);
      },
    },
    publisher: new PicturePackagePublisher({ artifactClient }),
  });
  const pictureHandler = createPictureHttpHandler({
    internalKey: INTERNAL_KEY,
    workspaceService,
    artifactClient,
    referenceService: new PictureReferenceService(artifactClient),
    readiness: async () => (await fetch(`${artifactUrl}/health`)).ok,
    handleMcp: async () => new Response("not used", { status: 501 }),
  });
  const pictureServer = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: pictureHandler });
  const pictureUrl = `http://127.0.0.1:${pictureServer.port}`;

  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${pictureUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${INTERNAL_KEY}`,
        "Content-Type": "application/json",
        "X-Nexus-User-Id": USER,
        "X-Nexus-Tenant-Id": TENANT,
        "X-Nexus-Session-Id": SESSION,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    if (!response.ok) throw new PictureError(String(payload.error), String(payload.message || payload.error), response.status);
    return payload;
  };
  const harness = { root, artifactServer, pictureServer, artifactClient, repositories, workspaceService, jobService, executor, request };
  harnesses.push(harness);
  return harness;
};

afterEach(async () => {
  const harness = harnesses.pop();
  if (!harness) return;
  harness.pictureServer.stop(true);
  harness.artifactServer.close();
  await once(harness.artifactServer, "close").catch(() => undefined);
  await rm(harness.root, { recursive: true, force: true });
});

test("persistent workspace flows through HTTP, worker, approval and selective cleanup", async () => {
  const harness = await createHarness();
  expect((await fetch(`http://127.0.0.1:${harness.pictureServer.port}/ready`)).status).toBe(200);
  const ensured = await harness.request("/internal/workspaces/ensure", "POST", { chat_session_id: SESSION, title: "Graduação ENS" });
  const workspaceId = ensured.data.id as string;
  const enqueued = await harness.jobService.enqueue({
    workspaceId, tenantId: TENANT, userId: USER, kind: "generate", idempotencyKey: "turn-1",
    specification: { owner_id: USER, session_id: SESSION, creative_brief: creativeBrief, composition_plan: compositionPlan, reference_artifact_ids: [] },
  });
  const worker = new PictureWorker({ jobService: harness.jobService, executor: harness.executor, workerId: "worker-a", heartbeatMs: 1_000 });
  expect(await worker.runOnce()).toBe(true);
  expect(harness.repositories.jobs.find((entry) => entry.id === enqueued.id)?.status).toBe("succeeded");

  const manifest = await harness.request(`/internal/workspaces/${workspaceId}/manifest`);
  expect(manifest.data.some((entry: Record<string, unknown>) => entry.relative_path === "brief/brief.json")).toBe(true);
  expect(manifest.data.some((entry: Record<string, unknown>) => entry.relative_path === "final/peca.png")).toBe(true);
  const approved = await harness.request(`/internal/workspaces/${workspaceId}/approve`, "POST", {});
  expect(approved.data.status).toBe("validated");
  expect(harness.repositories.validatedWorks).toHaveLength(1);

  const closed = await harness.request(`/internal/workspaces/${workspaceId}/reset`, "POST", {});
  expect(closed.data.status).toBe("closed");
  const remaining = await harness.artifactClient.listWorkspaceArtifacts({ ownerId: USER, workspaceId });
  expect(remaining).toHaveLength(1);
  expect(remaining[0]).toMatchObject({ id: approved.data.validated_artifact_id, lifecycle: "validated", relative_path: "final/peca.png" });
});

test("a worker restart reclaims an expired lease without duplicating the job", async () => {
  const harness = await createHarness();
  const ensured = await harness.request("/internal/workspaces/ensure", "POST", { chat_session_id: SESSION });
  const workspaceId = ensured.data.id as string;
  const input = {
    workspaceId, tenantId: TENANT, userId: USER, kind: "generate" as const, idempotencyKey: "restart-1",
    specification: { owner_id: USER, session_id: SESSION, creative_brief: creativeBrief, composition_plan: compositionPlan, reference_artifact_ids: [] },
  };
  const job = await harness.jobService.enqueue(input);
  expect((await harness.jobService.enqueue(input)).id).toBe(job.id);
  expect((await harness.jobService.claim("crashed-worker"))?.id).toBe(job.id);
  harness.repositories.expireLease(job.id);

  const replacement = new PictureWorker({ jobService: harness.jobService, executor: harness.executor, workerId: "replacement-worker" });
  expect(await replacement.runOnce()).toBe(true);
  expect(harness.repositories.jobs).toHaveLength(1);
  expect(harness.repositories.jobs[0]).toMatchObject({ id: job.id, status: "succeeded", attempt_count: 2 });
});
