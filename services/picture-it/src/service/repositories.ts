import type { DatabaseExecutor, DatabaseRow } from "./database.ts";

export interface PictureSession extends DatabaseRow {
  id: string;
  user_id: string;
  session_kind: "normal" | "picture";
}

export interface PictureWorkspace extends DatabaseRow {
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
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
}

export interface ValidatedVisualInput {
  workspaceId: string;
  tenantId: string;
  userId: string;
  artifactId: string;
  title: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface PictureWorkspaceRepository {
  getSession(id: string): Promise<PictureSession | null>;
  findActiveWorkspace(tenantId: string, userId: string): Promise<PictureWorkspace | null>;
  createWorkspace(input: { tenantId: string; userId: string; chatSessionId: string; title: string }): Promise<PictureWorkspace>;
  getOwnedWorkspace(workspaceId: string, tenantId: string, userId: string): Promise<PictureWorkspace | null>;
  setCandidate(workspaceId: string, version: number, artifactId: string): Promise<PictureWorkspace | null>;
  approveCandidate(input: ValidatedVisualInput): Promise<PictureWorkspace | null>;
  beginReset(workspaceId: string, tenantId: string, userId: string): Promise<PictureWorkspace | null>;
  closeAfterArtifactCleanup(workspaceId: string, tenantId: string, userId: string): Promise<PictureWorkspace | null>;
}

const first = <T>(rows: T[]) => rows[0] ?? null;

export class PostgresPictureWorkspaceRepository implements PictureWorkspaceRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async getSession(id: string) {
    return first(await this.database.query<PictureSession>(
      `select id, user_id, session_kind
         from public.chat_sessions
        where id = $1
        limit 1`,
      [id],
    ));
  }

  async findActiveWorkspace(tenantId: string, userId: string) {
    return first(await this.database.query<PictureWorkspace>(
      `select *
         from public.picture_workspaces
        where tenant_id = $1 and user_id = $2 and active = true
        order by created_at desc
        limit 1`,
      [tenantId, userId],
    ));
  }

  async createWorkspace(input: { tenantId: string; userId: string; chatSessionId: string; title: string }) {
    const workspace = first(await this.database.query<PictureWorkspace>(
      `insert into public.picture_workspaces (tenant_id, user_id, chat_session_id, title)
       values ($1, $2, $3, $4)
       returning *`,
      [input.tenantId, input.userId, input.chatSessionId, input.title],
    ));
    if (!workspace) throw new Error("picture_workspace_insert_failed");
    return workspace;
  }

  async getOwnedWorkspace(workspaceId: string, tenantId: string, userId: string) {
    return first(await this.database.query<PictureWorkspace>(
      `select *
         from public.picture_workspaces
        where id = $1 and tenant_id = $2 and user_id = $3
        limit 1`,
      [workspaceId, tenantId, userId],
    ));
  }

  async setCandidate(workspaceId: string, version: number, artifactId: string) {
    return first(await this.database.query<PictureWorkspace>(
      `update public.picture_workspaces
          set candidate_artifact_id = $3, status = 'review', current_job_id = null
        where id = $1
          and version = $2
          and active = true
          and status in ('drafting', 'generating', 'failed', 'review')
       returning *`,
      [workspaceId, version, artifactId],
    ));
  }

  async approveCandidate(input: ValidatedVisualInput) {
    return this.database.transaction(async (database) => {
      const workspace = first(await database.query<PictureWorkspace>(
        `select *
           from public.picture_workspaces
          where id = $1 and tenant_id = $2 and user_id = $3
          for update`,
        [input.workspaceId, input.tenantId, input.userId],
      ));
      if (!workspace) return null;
      if (workspace.status === "validated" && workspace.validated_work_id) return workspace;
      if (workspace.status !== "review" || workspace.candidate_artifact_id !== input.artifactId) return null;

      const content = JSON.stringify({
        workspace_id: input.workspaceId,
        artifact_id: input.artifactId,
        filename: input.filename,
      });
      const validated = first(await database.query<{ id: string } & DatabaseRow>(
        `insert into public.validated_works (
           tenant_id, artifact_type, title, content, status, tags, metadata,
           created_by_user_id, validated_by_user_id, validated_at,
           artifact_id, artifact_filename, artifact_mime_type, artifact_width, artifact_height
         ) values (
           $1, 'peca_visual', $2, $3, 'validated', array['picture-hermes'], $4::jsonb,
           $5, $5, timezone('utc', now()), $6, $7, $8, $9, $10
         )
         on conflict (artifact_id) where artifact_id is not null
         do update set updated_at = timezone('utc', now())
         returning id`,
        [
          input.tenantId,
          input.title,
          content,
          JSON.stringify({ source: "picture-hermes", workspace_id: input.workspaceId }),
          input.userId,
          input.artifactId,
          input.filename,
          input.mimeType,
          input.width,
          input.height,
        ],
      ));
      if (!validated) throw new Error("picture_validated_work_insert_failed");

      return first(await database.query<PictureWorkspace>(
        `update public.picture_workspaces
            set status = 'validated',
                candidate_artifact_id = $2,
                validated_artifact_id = $2,
                validated_work_id = $3,
                current_job_id = null
          where id = $1 and status = 'review' and candidate_artifact_id = $2
         returning *`,
        [input.workspaceId, input.artifactId, validated.id],
      ));
    });
  }

  async beginReset(workspaceId: string, tenantId: string, userId: string) {
    return this.database.transaction(async (database) => {
      const workspace = first(await database.query<PictureWorkspace>(
        `select * from public.picture_workspaces
          where id = $1 and tenant_id = $2 and user_id = $3
          for update`,
        [workspaceId, tenantId, userId],
      ));
      if (!workspace || workspace.status === "resetting" || workspace.status === "closed") return workspace;
      if (workspace.status !== "validated" || !workspace.validated_artifact_id) return null;
      return first(await database.query<PictureWorkspace>(
        `update public.picture_workspaces
            set status = 'resetting'
          where id = $1 and status = 'validated'
         returning *`,
        [workspaceId],
      ));
    });
  }

  async closeAfterArtifactCleanup(workspaceId: string, tenantId: string, userId: string) {
    return this.database.transaction(async (database) => {
      const workspace = first(await database.query<PictureWorkspace>(
        `select * from public.picture_workspaces
          where id = $1 and tenant_id = $2 and user_id = $3
          for update`,
        [workspaceId, tenantId, userId],
      ));
      if (!workspace || workspace.status === "closed") return workspace;
      if (workspace.status !== "resetting") return null;
      return first(await database.query<PictureWorkspace>(
        `update public.picture_workspaces
            set status = 'closed', active = false, closed_at = timezone('utc', now()), current_job_id = null
          where id = $1 and status = 'resetting'
         returning *`,
        [workspaceId],
      ));
    });
  }
}
