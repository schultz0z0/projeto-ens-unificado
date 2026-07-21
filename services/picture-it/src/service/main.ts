import { randomUUID } from "node:crypto";
import { PictureError } from "../errors.ts";
import { PictureArtifactClient } from "./artifact-client.ts";
import { PictureDatabase } from "./database.ts";
import { PictureEngineAdapter } from "./engine-adapter.ts";
import {
  JobService,
  PostgresPictureJobReader,
  PostgresPictureJobRepository,
} from "./job-service.ts";
import { createPictureHttpHandler, createPictureMcpHttpHandler, PictureReferenceService } from "./http-server.ts";
import { PicturePackageBuilder } from "./package-builder.ts";
import { PicturePackagePublisher } from "./package-publisher.ts";
import { PostgresPictureWorkspaceRepository } from "./repositories.ts";
import { PictureJobExecutor, PictureWorker, runWorkerPool } from "./worker.ts";
import { WorkspaceService } from "./workspace-service.ts";

const required = (name: string) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new PictureError("picture_runtime_config_invalid", `${name} is required.`, 500);
  return value;
};

const positiveInt = (name: string, fallback: number, maximum: number) => {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? Math.min(maximum, Math.floor(value)) : fallback;
};

export const startPictureService = () => {
  const databaseUrl = required("DATABASE_URL");
  const artifactUrl = required("ARTIFACT_INTERNAL_URL");
  const artifactKey = required("ARTIFACT_INTERNAL_KEY");
  const internalKey = required("PICTURE_INTERNAL_KEY");
  const activeKid = required("PICTURE_DELEGATION_ACTIVE_KID");
  const activeKey = required("PICTURE_DELEGATION_ACTIVE_KEY");
  if (internalKey.length < 32 || activeKey.length < 32) {
    throw new PictureError("picture_runtime_config_invalid", "Picture internal and delegation keys must contain at least 32 characters.", 500);
  }

  const database = new PictureDatabase(databaseUrl);
  const artifactClient = new PictureArtifactClient({
    baseUrl: artifactUrl,
    internalKey: artifactKey,
    timeoutMs: positiveInt("PICTURE_ARTIFACT_TIMEOUT_MS", 30_000, 300_000),
  });
  const workspaceRepository = new PostgresPictureWorkspaceRepository(database);
  const workspaceService = new WorkspaceService({ repository: workspaceRepository, artifactClient });
  const jobRepository = new PostgresPictureJobRepository(database);
  const jobService = new JobService({
    repository: jobRepository,
    leaseSeconds: positiveInt("PICTURE_WORKER_LEASE_SECONDS", 120, 3_600),
    maxAttempts: positiveInt("PICTURE_WORKER_MAX_ATTEMPTS", 3, 10),
  });
  const jobReader = new PostgresPictureJobReader(database);
  const packageBuilder = new PicturePackageBuilder({
    artifactClient,
    tempRoot: process.env.PICTURE_TEMP_ROOT || undefined,
  });
  const publisher = new PicturePackagePublisher({ artifactClient });
  const engine = new PictureEngineAdapter();
  const executor = new PictureJobExecutor({
    artifactClient,
    packageBuilder,
    publisher,
    engine,
  });
  const keyring = {
    activeKid,
    activeKey,
    previousKid: process.env.PICTURE_DELEGATION_PREVIOUS_KID || undefined,
    previousKey: process.env.PICTURE_DELEGATION_PREVIOUS_KEY || undefined,
    issuer: process.env.PICTURE_DELEGATION_ISSUER || "nexus-chat-bridge",
    audience: process.env.PICTURE_DELEGATION_AUDIENCE || "nexus-picture",
    maxTtlSeconds: positiveInt("PICTURE_DELEGATION_MAX_TTL_SECONDS", 120, 300),
  };
  const mcpDependencies = { keyring, workspaceService, jobService, jobReader };
  const handleMcp = createPictureMcpHttpHandler(mcpDependencies);
  const referenceService = new PictureReferenceService(artifactClient);
  const allowedOrigins = String(process.env.PICTURE_ALLOWED_ORIGINS || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const handler = createPictureHttpHandler({
    internalKey,
    workspaceService,
    artifactClient,
    referenceService,
    allowedOrigins,
    handleMcp,
    readiness: async () => {
      try {
        await database.query("select 1 as ok");
        const response = await fetch(`${artifactUrl.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(2_000) });
        return response.ok;
      } catch { return false; }
    },
  });

  const abortController = new AbortController();
  const concurrency = positiveInt("PICTURE_WORKER_CONCURRENCY", 1, 32);
  const pool = runWorkerPool({
    concurrency,
    signal: abortController.signal,
    createWorker: (index) => new PictureWorker({
      jobService,
      executor,
      workerId: `${process.env.HOSTNAME || "picture"}-${index}-${randomUUID().slice(0, 8)}`,
      heartbeatMs: positiveInt("PICTURE_WORKER_HEARTBEAT_MS", 30_000, 300_000),
      pollMs: positiveInt("PICTURE_WORKER_POLL_MS", 1_000, 60_000),
    }),
  }).catch((error) => {
    if (!abortController.signal.aborted) console.error("[picture] worker pool stopped", error);
  });
  const port = positiveInt("PICTURE_PORT", 8090, 65_535);
  const server = Bun.serve({ port, hostname: "0.0.0.0", fetch: handler });
  console.log(`[picture] listening on 0.0.0.0:${server.port}`);

  const shutdown = async () => {
    if (abortController.signal.aborted) return;
    abortController.abort();
    server.stop(true);
    await pool;
    await database.close();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
  return { server, shutdown };
};

if (import.meta.main) startPictureService();
