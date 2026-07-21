import { expect, test } from "bun:test";

const loadWorker = async () => {
  try {
    return await import("../src/service/worker.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

const job = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  kind: "generate" as const,
  status: "running" as const,
  idempotency_key: "turn-1",
  specification: { owner_id: "44444444-4444-4444-8444-444444444444" },
  progress: 0,
  attempt_count: 1,
  max_attempts: 3,
  lease_owner: "worker-a",
  lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
  result_artifact_id: null,
};

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

test("worker heartbeats and completes only after executor returns a final artifact", async () => {
  const { PictureWorker } = await loadWorker();
  const calls: string[] = [];
  let claimed = false;
  const jobs = {
    async claim() { if (claimed) return null; claimed = true; return job; },
    async heartbeat() { calls.push("heartbeat"); return job; },
    async complete(_id: string, _worker: string, artifactId: string) { calls.push(`complete:${artifactId}`); return { ...job, status: "succeeded" as const }; },
    async fail() { calls.push("fail"); return job; },
  };
  const worker = new PictureWorker({
    jobService: jobs,
    executor: { async execute() { await Bun.sleep(15); return { finalArtifactId: "33333333-3333-4333-8333-333333333333" }; } },
    workerId: "worker-a",
    heartbeatMs: 5,
  });
  expect(await worker.runOnce()).toBe(true);
  expect(calls.some((call) => call === "heartbeat")).toBe(true);
  expect(calls.at(-1)).toBe("complete:33333333-3333-4333-8333-333333333333");
});

test("worker reports failure and executor always cleans the temporary package", async () => {
  const { PictureJobExecutor, PictureWorker } = await loadWorker();
  let cleaned = 0;
  const executor = new PictureJobExecutor({
    artifactClient: {
      async listWorkspaceArtifacts() { return []; },
      async downloadArtifact() { return { bytes: new Uint8Array(), contentType: "application/octet-stream" }; },
    },
    packageBuilder: { async build() { return { root: "temp", finalPath: "temp/final.png", async cleanup() { cleaned += 1; } }; } },
    engine: { async execute() { throw Object.assign(new Error("fal unavailable"), { code: "fal_unavailable" }); } },
    publisher: { async publish() { return []; } },
  });
  let failed = 0;
  const worker = new PictureWorker({
    jobService: {
      async claim() { return job; },
      async heartbeat() { return job; },
      async complete() { return job; },
      async fail() { failed += 1; return { ...job, status: "queued" as const }; },
    },
    executor,
    workerId: "worker-a",
    heartbeatMs: 100,
  });
  expect(await worker.runOnce()).toBe(true);
  expect(failed).toBe(1);
  expect(cleaned).toBe(1);
});

test("engine adapter invokes the library pipeline rather than the CLI", async () => {
  const { PictureEngineAdapter } = await import("../src/service/engine-adapter.ts");
  const calls: unknown[][] = [];
  const adapter = new PictureEngineAdapter({ executePipeline: async (...args: unknown[]) => { calls.push(args); return String(args[1]); } });
  const result = await adapter.execute({
    packageRoot: "C:/temp/package",
    finalPath: "C:/temp/package/final/piece.png",
    compositionPlan: {
      version: 1,
      base_prompt: "A",
      pipeline: [{ op: "generate", prompt: "A", size: "1080x1350" }],
      final_path: "final/piece.png",
    },
  });
  expect(result).toContain("final/piece.png");
  expect(calls).toHaveLength(1);
});

test("executor normalizes Artifact Server metadata before building the package", async () => {
  const { PictureJobExecutor } = await loadWorker();
  let buildInput: Record<string, any> | undefined;
  const executor = new PictureJobExecutor({
    artifactClient: {
      async listWorkspaceArtifacts() {
        return [{
          id: "55555555-5555-4555-8555-555555555555",
          workspace_id: job.workspace_id,
          relative_path: "references/logo.png",
          category: "reference",
          content_type: "image/png",
          size: 123,
          lifecycle: "workspace",
          created_at: "2026-07-21T00:00:00.000Z",
        }];
      },
      async downloadArtifact() { return { bytes: new Uint8Array(), contentType: "application/json" }; },
    },
    packageBuilder: {
      async build(input) {
        buildInput = input;
        return { root: "temp", finalPath: "temp/final/peca.png", async cleanup() {} };
      },
    },
    engine: { async execute() { return "temp/final/peca.png"; } },
    publisher: { async publish() { return [{ id: "66666666-6666-4666-8666-666666666666", relative_path: "final/peca.png" }]; } },
  });

  await executor.execute({
    ...job,
    specification: {
      owner_id: "44444444-4444-4444-8444-444444444444",
      creative_brief: creativeBrief,
      composition_plan: compositionPlan,
      reference_artifact_ids: ["55555555-5555-4555-8555-555555555555"],
    },
  });

  expect(buildInput?.manifest[0]).toMatchObject({
    artifact_id: "55555555-5555-4555-8555-555555555555",
    workspace_id: job.workspace_id,
    relative_path: "references/logo.png",
  });
});

test("revision restores the persisted brief and reference manifest", async () => {
  const { PictureJobExecutor } = await loadWorker();
  const briefId = "77777777-7777-4777-8777-777777777777";
  const referenceId = "88888888-8888-4888-8888-888888888888";
  let buildInput: Record<string, any> | undefined;
  const metadata = (id: string, relativePath: string, category: string, contentType: string) => ({
    id,
    workspace_id: job.workspace_id,
    relative_path: relativePath,
    category,
    content_type: contentType,
    size: 123,
    lifecycle: "workspace",
    created_at: "2026-07-21T00:00:00.000Z",
  });
  const executor = new PictureJobExecutor({
    artifactClient: {
      async listWorkspaceArtifacts() {
        return [
          metadata(briefId, "brief/brief.json", "brief", "application/json"),
          metadata(referenceId, "references/logo.png", "reference", "image/png"),
        ];
      },
      async downloadArtifact(artifactId: string) {
        expect(artifactId).toBe(briefId);
        return { bytes: new TextEncoder().encode(JSON.stringify(creativeBrief)), contentType: "application/json" };
      },
    },
    packageBuilder: {
      async build(input) {
        buildInput = input;
        return { root: "temp", finalPath: "temp/final/peca.png", async cleanup() {} };
      },
    },
    engine: { async execute() { return "temp/final/peca.png"; } },
    publisher: { async publish() { return [{ id: "99999999-9999-4999-8999-999999999999", relative_path: "final/peca.png" }]; } },
  });

  await executor.execute({
    ...job,
    kind: "revise",
    specification: {
      owner_id: "44444444-4444-4444-8444-444444444444",
      revision_request: "Aumente o contraste",
      composition_plan: compositionPlan,
      reference_artifact_ids: [],
    },
  });

  expect(buildInput?.creativeBrief).toEqual(creativeBrief);
  expect(buildInput?.referenceArtifactIds).toEqual([referenceId]);
});
