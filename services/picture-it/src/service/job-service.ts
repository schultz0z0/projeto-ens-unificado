import { PictureError } from "../errors.ts";
import type { DatabaseExecutor, DatabaseRow } from "./database.ts";

export interface PictureJob extends DatabaseRow {
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
  error_code?: string | null;
  error_message?: string | null;
}

export interface JobRepository {
  enqueue(input: {
    workspaceId: string;
    tenantId: string;
    userId: string;
    kind: "generate" | "revise";
    idempotencyKey: string;
    specification: Record<string, unknown>;
    maxAttempts: number;
  }): Promise<PictureJob | null>;
  claim(workerId: string, leaseSeconds: number): Promise<PictureJob | null>;
  heartbeat(jobId: string, workerId: string, leaseSeconds: number): Promise<PictureJob | null>;
  complete(input: { jobId: string; workerId: string; resultArtifactId: string }): Promise<PictureJob | null>;
  fail(input: { jobId: string; workerId: string; errorCode: string; errorMessage: string; retryable: boolean }): Promise<PictureJob | null>;
}

const first = <T>(rows: T[]) => rows[0] ?? null;

export class PostgresPictureJobRepository implements JobRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async enqueue(input: {
    workspaceId: string;
    tenantId: string;
    userId: string;
    kind: "generate" | "revise";
    idempotencyKey: string;
    specification: Record<string, unknown>;
    maxAttempts: number;
  }) {
    return this.database.transaction(async (database) => {
      const workspace = first(await database.query<{ id: string; status: string; active: boolean } & DatabaseRow>(
        `select id, status, active
           from public.picture_workspaces
          where id = $1 and tenant_id = $2 and user_id = $3
          for update`,
        [input.workspaceId, input.tenantId, input.userId],
      ));
      if (!workspace || !workspace.active) return null;
      const duplicate = first(await database.query<PictureJob>(
        `select * from public.picture_jobs where workspace_id = $1 and idempotency_key = $2 limit 1`,
        [input.workspaceId, input.idempotencyKey],
      ));
      if (duplicate) return duplicate;
      const active = first(await database.query<{ id: string } & DatabaseRow>(
        `select id from public.picture_jobs
          where workspace_id = $1 and status in ('queued', 'running')
          limit 1`,
        [input.workspaceId],
      ));
      // Ensure specification is a clean JS object (parse if it arrived as a string)
      let specObj: Record<string, unknown>;
      if (typeof input.specification === "string") {
        try {
          specObj = JSON.parse(input.specification);
        } catch {
          specObj = { raw: input.specification };
        }
      } else if (typeof input.specification === "object" && input.specification !== null) {
        specObj = input.specification as Record<string, unknown>;
      } else {
        specObj = {};
      }
      
      // IMPORTANT: Pass specObj directly to Bun SQL. 
      // Bun SQL's native Postgres client automatically serializes JS objects to JSONB.
      // Passing JSON.stringify(specObj) causes it to double-encode into a JSON string,
      // which violates the picture_jobs_specification_object_check constraint.
      const job = first(await database.query<PictureJob>(
        `insert into public.picture_jobs (workspace_id, kind, idempotency_key, specification, max_attempts)
         values ($1, $2, $3, $4::jsonb, $5)
         returning *`,
        [input.workspaceId, input.kind, input.idempotencyKey, specObj, input.maxAttempts],
      ));
      if (!job) throw new Error("picture_job_insert_failed");
      await database.query<DatabaseRow>(
        `update public.picture_workspaces
            set status = 'generating', current_job_id = $2
          where id = $1`,
        [input.workspaceId, job.id],
      );
      return job;
    });
  }

  async claim(workerId: string, leaseSeconds: number) {
    return this.database.transaction(async (database) => {
      const exhausted = await database.query<{ workspace_id: string } & DatabaseRow>(
        `update public.picture_jobs
            set status = 'failed', completed_at = timezone('utc', now()),
                lease_owner = null, lease_expires_at = null,
                error_code = coalesce(error_code, 'picture_job_attempts_exhausted'),
                error_message = coalesce(error_message, 'Maximum attempts exhausted.')
          where status = 'running'
            and lease_expires_at <= timezone('utc', now())
            and attempt_count >= max_attempts
         returning workspace_id`,
      );
      for (const entry of exhausted) {
        await database.query<DatabaseRow>(
          `update public.picture_workspaces
              set status = case when candidate_artifact_id is null then 'failed' else 'review' end,
                  current_job_id = null
            where id = $1`,
          [entry.workspace_id],
        );
      }
      const candidate = first(await database.query<{ id: string } & DatabaseRow>(
        `select id
           from public.picture_jobs
          where status = 'queued'
             or (status = 'running' and lease_expires_at <= timezone('utc', now()) and attempt_count < max_attempts)
          order by created_at asc
          for update skip locked
          limit 1`,
      ));
      if (!candidate) return null;
      return first(await database.query<PictureJob>(
        `update public.picture_jobs
            set status = 'running', attempt_count = attempt_count + 1,
                lease_owner = $2,
                lease_expires_at = timezone('utc', now()) + ($3 * interval '1 second'),
                started_at = coalesce(started_at, timezone('utc', now())),
                error_code = null, error_message = null
          where id = $1
         returning *`,
        [candidate.id, workerId, leaseSeconds],
      ));
    });
  }

  async heartbeat(jobId: string, workerId: string, leaseSeconds: number) {
    return first(await this.database.query<PictureJob>(
      `update public.picture_jobs
          set lease_expires_at = timezone('utc', now()) + ($3 * interval '1 second')
        where id = $1 and status = 'running' and lease_owner = $2
       returning *`,
      [jobId, workerId, leaseSeconds],
    ));
  }

  async complete(input: { jobId: string; workerId: string; resultArtifactId: string }) {
    return this.database.transaction(async (database) => {
      const job = first(await database.query<PictureJob>(
        `update public.picture_jobs
            set status = 'succeeded', progress = 100, result_artifact_id = $3,
                completed_at = timezone('utc', now()), lease_owner = null, lease_expires_at = null
          where id = $1 and status = 'running' and lease_owner = $2
         returning *`,
        [input.jobId, input.workerId, input.resultArtifactId],
      ));
      if (!job) return null;
      await database.query<DatabaseRow>(
        `update public.picture_workspaces
            set status = 'review', candidate_artifact_id = $2, current_job_id = null
          where id = $1 and current_job_id = $3`,
        [job.workspace_id, input.resultArtifactId, job.id],
      );
      return job;
    });
  }

  async fail(input: { jobId: string; workerId: string; errorCode: string; errorMessage: string; retryable: boolean }) {
    return this.database.transaction(async (database) => {
      const locked = first(await database.query<PictureJob>(
        `select * from public.picture_jobs
          where id = $1 and status = 'running' and lease_owner = $2
          for update`,
        [input.jobId, input.workerId],
      ));
      if (!locked) return null;
      const retry = input.retryable && locked.attempt_count < locked.max_attempts;
      const job = first(await database.query<PictureJob>(
        `update public.picture_jobs
            set status = $3, error_code = $4, error_message = $5,
                lease_owner = null, lease_expires_at = null,
                completed_at = case when $3 = 'failed' then timezone('utc', now()) else null end
          where id = $1 and lease_owner = $2
         returning *`,
        [input.jobId, input.workerId, retry ? "queued" : "failed", input.errorCode, input.errorMessage],
      ));
      if (job && !retry) {
        await database.query<DatabaseRow>(
          `update public.picture_workspaces
              set status = case when candidate_artifact_id is null then 'failed' else 'review' end,
                  current_job_id = null
            where id = $1 and current_job_id = $2`,
          [job.workspace_id, job.id],
        );
      }
      return job;
    });
  }
}

export class JobService {
  readonly leaseSeconds: number;
  constructor(private readonly options: { repository: JobRepository; leaseSeconds?: number; maxAttempts?: number }) {
    this.leaseSeconds = Math.max(5, options.leaseSeconds ?? 120);
  }

  async enqueue(input: {
    workspaceId: string;
    tenantId: string;
    userId: string;
    kind: "generate" | "revise";
    idempotencyKey: string;
    specification: Record<string, unknown>;
    maxAttempts?: number;
  }) {
    try {
      const job = await this.options.repository.enqueue({
        ...input,
        maxAttempts: Math.min(10, Math.max(1, input.maxAttempts ?? this.options.maxAttempts ?? 3)),
      });
      if (!job) throw new PictureError("picture_workspace_not_found", "Picture workspace was not found.", 404);
      return job;
    } catch (error) {
      if (error instanceof PictureError) throw error;
      const msg = String((error as { message?: string })?.message || error || "");
      const code = (error as { code?: string })?.code;
      if (code === "picture_job_active" || code === "23505" || msg.includes("picture_job_active")) {
        throw new PictureError("picture_job_active", "This workspace already has an active rendering job.", 409);
      }
      // PostgreSQL check constraint violation (via code 23514 or error message text)
      if (code === "23514" || msg.includes("check constraint") || msg.includes("violates check constraint")) {
        const constraint = (error as { constraint_name?: string })?.constraint_name
          || (error as { constraint?: string })?.constraint
          || msg.match(/\"([^"]+)\"/)?.[1]
          || "unknown";
        const detail = (error as { detail?: string })?.detail || "";
        throw new PictureError(
          "picture_contract_invalid",
          `Database constraint violated: ${constraint}. ${detail || msg}`.trim(),
          400,
        );
      }
      throw error;
    }
  }

  claim(workerId: string) {
    return this.options.repository.claim(workerId, this.leaseSeconds);
  }

  heartbeat(jobId: string, workerId: string) {
    return this.options.repository.heartbeat(jobId, workerId, this.leaseSeconds);
  }

  complete(jobId: string, workerId: string, resultArtifactId: string) {
    return this.options.repository.complete({ jobId, workerId, resultArtifactId });
  }

  fail(jobId: string, workerId: string, error: unknown) {
    const code = String((error as { code?: unknown })?.code || "picture_render_failed").slice(0, 120);
    const message = String((error as { message?: unknown })?.message || "Rendering failed.").slice(0, 1_000);
    const retryable = !["picture_contract_invalid", "picture_reference_not_owned", "picture_package_path_invalid"].includes(code);
    return this.options.repository.fail({ jobId, workerId, errorCode: code, errorMessage: message, retryable });
  }
}

export class PostgresPictureJobReader {
  constructor(private readonly database: DatabaseExecutor) {}

  async getOwnedJob(input: { tenantId: string; userId: string; workspaceId: string; jobId: string }) {
    const job = first(await this.database.query<PictureJob>(
      `select job.*
         from public.picture_jobs job
         join public.picture_workspaces workspace on workspace.id = job.workspace_id
        where job.id = $1
          and job.workspace_id = $2
          and workspace.tenant_id = $3
          and workspace.user_id = $4
        limit 1`,
      [input.jobId, input.workspaceId, input.tenantId, input.userId],
    ));
    if (!job) throw new PictureError("picture_job_not_found", "Picture job was not found.", 404);
    return job;
  }
}
