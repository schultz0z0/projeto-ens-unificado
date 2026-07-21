import { expect, test } from "bun:test";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

const loadJobs = async () => {
  try {
    return await import("../src/service/job-service.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

type Job = {
  id: string;
  workspace_id: string;
  kind: "generate" | "revise";
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  idempotency_key: string;
  specification: Record<string, unknown>;
  progress: number;
  attempt_count: number;
  max_attempts: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  result_artifact_id: string | null;
};

class MemoryJobRepository {
  jobs: Job[] = [];
  workspace = { id: WORKSPACE, tenant_id: "ens", user_id: USER, active: true };

  async enqueue(input: { workspaceId: string; tenantId: string; userId: string; kind: "generate" | "revise"; idempotencyKey: string; specification: Record<string, unknown>; maxAttempts: number }) {
    await Promise.resolve();
    if (input.workspaceId !== this.workspace.id || input.userId !== this.workspace.user_id) return null;
    const duplicate = this.jobs.find((job) => job.workspace_id === input.workspaceId && job.idempotency_key === input.idempotencyKey);
    if (duplicate) return duplicate;
    if (this.jobs.some((job) => job.workspace_id === input.workspaceId && ["queued", "running"].includes(job.status))) {
      throw Object.assign(new Error("active"), { code: "picture_job_active" });
    }
    const job: Job = {
      id: `33333333-3333-4333-8333-${String(this.jobs.length + 1).padStart(12, "0")}`,
      workspace_id: input.workspaceId,
      kind: input.kind,
      status: "queued",
      idempotency_key: input.idempotencyKey,
      specification: input.specification,
      progress: 0,
      attempt_count: 0,
      max_attempts: input.maxAttempts,
      lease_owner: null,
      lease_expires_at: null,
      result_artifact_id: null,
    };
    this.jobs.push(job);
    return job;
  }

  async claim(workerId: string, leaseSeconds: number, now = new Date()) {
    for (const job of this.jobs.filter((item) => item.status === "running" && item.lease_expires_at && new Date(item.lease_expires_at) <= now)) {
      if (job.attempt_count >= job.max_attempts) {
        job.status = "failed";
        job.lease_owner = null;
        job.lease_expires_at = null;
      }
    }
    const job = this.jobs.find((item) => item.status === "queued" || (item.status === "running" && item.lease_expires_at && new Date(item.lease_expires_at) <= now && item.attempt_count < item.max_attempts));
    if (!job) return null;
    job.status = "running";
    job.attempt_count += 1;
    job.lease_owner = workerId;
    job.lease_expires_at = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
    return { ...job };
  }

  async heartbeat(jobId: string, workerId: string, leaseSeconds: number) {
    const job = this.jobs.find((item) => item.id === jobId && item.status === "running" && item.lease_owner === workerId);
    if (!job) return null;
    job.lease_expires_at = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    return { ...job };
  }

  async complete(input: { jobId: string; workerId: string; resultArtifactId: string }) {
    const job = this.jobs.find((item) => item.id === input.jobId && item.lease_owner === input.workerId);
    if (!job) return null;
    job.status = "succeeded";
    job.result_artifact_id = input.resultArtifactId;
    job.lease_owner = null;
    job.lease_expires_at = null;
    return { ...job };
  }

  async fail(input: { jobId: string; workerId: string }) {
    const job = this.jobs.find((item) => item.id === input.jobId && item.lease_owner === input.workerId);
    if (!job) return null;
    job.status = job.attempt_count < job.max_attempts ? "queued" : "failed";
    job.lease_owner = null;
    job.lease_expires_at = null;
    return { ...job };
  }
}

test("enqueue is idempotent and prevents two active jobs", async () => {
  const { JobService } = await loadJobs();
  const repository = new MemoryJobRepository();
  const service = new JobService({ repository });
  const input = { workspaceId: WORKSPACE, tenantId: "ens", userId: USER, kind: "generate" as const, idempotencyKey: "turn-1", specification: { prompt: "x" } };
  const [first, second] = await Promise.all([service.enqueue(input), service.enqueue(input)]);
  expect(first.id).toBe(second.id);
  expect(repository.jobs).toHaveLength(1);
  await expect(service.enqueue({ ...input, idempotencyKey: "turn-2" })).rejects.toMatchObject({ code: "picture_job_active" });
});

test("claim is exclusive, recovers an expired lease and exhausts max attempts", async () => {
  const { JobService } = await loadJobs();
  const repository = new MemoryJobRepository();
  const service = new JobService({ repository, leaseSeconds: 10 });
  await service.enqueue({ workspaceId: WORKSPACE, tenantId: "ens", userId: USER, kind: "generate", idempotencyKey: "turn-1", specification: {}, maxAttempts: 2 });
  const [first, none] = await Promise.all([service.claim("worker-a"), service.claim("worker-b")]);
  expect(first?.lease_owner).toBe("worker-a");
  expect(none).toBeNull();
  repository.jobs[0]!.lease_expires_at = "2000-01-01T00:00:00.000Z";
  const recovered = await service.claim("worker-b");
  expect(recovered?.attempt_count).toBe(2);
  repository.jobs[0]!.lease_expires_at = "2000-01-01T00:00:00.000Z";
  expect(await service.claim("worker-c")).toBeNull();
  expect(repository.jobs[0]!.status).toBe("failed");
});

test("heartbeat extends only a matching active lease", async () => {
  const { JobService } = await loadJobs();
  const repository = new MemoryJobRepository();
  const service = new JobService({ repository, leaseSeconds: 60 });
  await service.enqueue({ workspaceId: WORKSPACE, tenantId: "ens", userId: USER, kind: "revise", idempotencyKey: "rev-1", specification: {} });
  const job = await service.claim("worker-a");
  const before = job!.lease_expires_at;
  expect(await service.heartbeat(job!.id, "worker-b")).toBeNull();
  const extended = await service.heartbeat(job!.id, "worker-a");
  expect(new Date(extended!.lease_expires_at!).getTime()).toBeGreaterThanOrEqual(new Date(before!).getTime());
});
