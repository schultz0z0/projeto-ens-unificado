import { PictureError } from "../errors.ts";
import { ManifestEntrySchema, type ManifestEntry } from "./contracts.ts";
import type { PictureJob } from "./job-service.ts";

interface WorkerJobService {
  claim(workerId: string): Promise<PictureJob | null>;
  heartbeat(jobId: string, workerId: string): Promise<PictureJob | null>;
  complete(jobId: string, workerId: string, resultArtifactId: string): Promise<PictureJob | null>;
  fail(jobId: string, workerId: string, error: unknown): Promise<PictureJob | null>;
}

interface JobExecutor {
  execute(job: PictureJob, signal?: AbortSignal): Promise<{ finalArtifactId: string }>;
}

export class PictureJobExecutor implements JobExecutor {
  constructor(private readonly options: {
    artifactClient: {
      listWorkspaceArtifacts(input: { ownerId: string; workspaceId: string; signal?: AbortSignal }): Promise<unknown[]>;
      downloadArtifact(artifactId: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; contentType: string }>;
    };
    packageBuilder: { build(input: Record<string, unknown>): Promise<{ root: string; finalPath: string; cleanup(): Promise<void> }> };
    engine: { execute(input: Record<string, unknown>): Promise<string> };
    publisher: { publish(input: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  }) {}

  private normalizeManifest(entries: unknown[], workspaceId: string): ManifestEntry[] {
    return entries.map((value) => {
      const artifact = value as Record<string, unknown>;
      return ManifestEntrySchema.parse({
        artifact_id: artifact.artifact_id || artifact.id,
        workspace_id: artifact.workspace_id || workspaceId,
        relative_path: artifact.relative_path,
        category: artifact.category,
        content_type: artifact.content_type,
        size: Number(artifact.size),
        lifecycle: artifact.lifecycle,
        ...(artifact.preview_url ? { preview_url: artifact.preview_url } : {}),
        ...(artifact.preview_url_expires_at ? { preview_url_expires_at: artifact.preview_url_expires_at } : {}),
        created_at: artifact.created_at,
      });
    });
  }

  private async restoreRevisionBrief(manifest: ManifestEntry[], signal?: AbortSignal) {
    const brief = manifest
      .filter((entry) => entry.category === "brief" && entry.relative_path === "brief/brief.json")
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
    if (!brief) {
      throw new PictureError("picture_revision_brief_missing", "The original creative brief is unavailable for revision.", 409);
    }
    try {
      const downloaded = await this.options.artifactClient.downloadArtifact(brief.artifact_id, signal);
      return JSON.parse(new TextDecoder().decode(downloaded.bytes));
    } catch (error) {
      if (error instanceof PictureError) throw error;
      throw new PictureError("picture_revision_brief_invalid", "The original creative brief cannot be restored.", 409, { cause: error });
    }
  }

  private revisionReferenceIds(manifest: ManifestEntry[]) {
    const newestByPath = new Map<string, ManifestEntry>();
    for (const entry of manifest
      .filter((candidate) => candidate.category === "reference" && candidate.lifecycle === "workspace")
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))) {
      newestByPath.set(entry.relative_path, entry);
    }
    return [...newestByPath.values()].map((entry) => entry.artifact_id);
  }

  async execute(job: PictureJob, signal?: AbortSignal) {
    const specification = job.specification as Record<string, any>;
    const ownerId = String(specification.owner_id || specification.user_id || "");
    const sessionId = specification.session_id ? String(specification.session_id) : undefined;
    if (!ownerId) throw new PictureError("picture_job_owner_missing", "Job owner is missing.", 500);
    const manifest = this.normalizeManifest(await this.options.artifactClient.listWorkspaceArtifacts({
      ownerId,
      workspaceId: job.workspace_id,
      signal,
    }), job.workspace_id);
    const creativeBrief = specification.creative_brief
      ?? (job.kind === "revise" ? await this.restoreRevisionBrief(manifest, signal) : undefined);
    const requestedReferences = Array.isArray(specification.reference_artifact_ids)
      ? specification.reference_artifact_ids
      : [];
    const referenceArtifactIds = job.kind === "revise" && requestedReferences.length === 0
      ? this.revisionReferenceIds(manifest)
      : requestedReferences;
    const built = await this.options.packageBuilder.build({
      workspaceId: job.workspace_id,
      jobId: job.id,
      creativeBrief,
      compositionPlan: specification.composition_plan,
      referenceArtifactIds,
      manifest,
      signal,
    });
    try {
      await this.options.engine.execute({
        packageRoot: built.root,
        finalPath: built.finalPath,
        compositionPlan: specification.composition_plan,
      });
      const published = await this.options.publisher.publish({
        root: built.root,
        jobId: job.id,
        ownerId,
        workspaceId: job.workspace_id,
        sessionId,
        signal,
      });
      const finalPath = String(specification.composition_plan?.final_path || "");
      const finalArtifact = published.find((artifact) => artifact.relative_path === finalPath);
      const finalArtifactId = String(finalArtifact?.id || "");
      if (!finalArtifactId) {
        throw new PictureError("picture_final_artifact_missing", "Final artifact was not published.", 500);
      }
      return { finalArtifactId };
    } finally {
      await built.cleanup();
    }
  }
}

export class PictureWorker {
  private readonly heartbeatMs: number;
  private readonly pollMs: number;
  constructor(private readonly options: {
    jobService: WorkerJobService;
    executor: JobExecutor;
    workerId: string;
    heartbeatMs?: number;
    pollMs?: number;
  }) {
    this.heartbeatMs = Math.max(5, options.heartbeatMs ?? 30_000);
    this.pollMs = Math.max(10, options.pollMs ?? 1_000);
  }

  async runOnce(signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return false;
    const job = await this.options.jobService.claim(this.options.workerId);
    if (!job) return false;
    const heartbeat = setInterval(() => {
      void this.options.jobService.heartbeat(job.id, this.options.workerId).catch(() => undefined);
    }, this.heartbeatMs);
    try {
      const result = await this.options.executor.execute(job, signal);
      const completed = await this.options.jobService.complete(job.id, this.options.workerId, result.finalArtifactId);
      if (!completed) throw new PictureError("picture_job_lease_lost", "Job lease was lost before completion.", 409);
    } catch (error) {
      await this.options.jobService.fail(job.id, this.options.workerId, error);
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }

  async run(signal: AbortSignal) {
    while (!signal.aborted) {
      const worked = await this.runOnce(signal);
      if (!worked && !signal.aborted) await Bun.sleep(this.pollMs);
    }
  }
}

export const runWorkerPool = async (input: {
  concurrency: number;
  createWorker(index: number): PictureWorker;
  signal: AbortSignal;
}) => {
  const concurrency = Math.min(32, Math.max(1, input.concurrency));
  await Promise.all(Array.from({ length: concurrency }, (_, index) => input.createWorker(index).run(input.signal)));
};
