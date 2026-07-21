-- Picture-Hermes persistent workspace, recoverable jobs, and visual validated works.

alter table public.chat_sessions
  add column if not exists session_kind text not null default 'normal';

alter table public.chat_sessions
  drop constraint if exists chat_sessions_session_kind_check;

alter table public.chat_sessions
  add constraint chat_sessions_session_kind_check
  check (session_kind in ('normal', 'picture'));

-- Authenticated clients can create normal sessions through defaults, but cannot
-- forge or change session_kind. Picture sessions are created by the Bridge.
revoke insert, update on public.chat_sessions from authenticated;
grant insert (user_id, title) on public.chat_sessions to authenticated;
grant update (title, updated_at, user_message_count) on public.chat_sessions to authenticated;

create table if not exists public.picture_workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'ens',
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_session_id uuid not null unique references public.chat_sessions(id) on delete cascade,
  status text not null default 'drafting'
    check (status in ('drafting', 'generating', 'review', 'validated', 'resetting', 'closed', 'failed')),
  active boolean not null default true,
  current_job_id uuid,
  candidate_artifact_id uuid,
  validated_artifact_id uuid,
  validated_work_id uuid references public.validated_works(id) on delete set null,
  title text not null default 'Nova peça',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  constraint picture_workspaces_title_check check (char_length(title) between 1 and 180),
  constraint picture_workspaces_closed_state_check check (
    (status = 'closed' and active = false and closed_at is not null)
    or status <> 'closed'
  ),
  constraint picture_workspaces_validated_state_check check (
    status <> 'validated'
    or (candidate_artifact_id is not null and validated_artifact_id is not null and validated_work_id is not null)
  )
);

create unique index if not exists picture_workspaces_one_active_per_user
  on public.picture_workspaces (tenant_id, user_id)
  where active;

create index if not exists picture_workspaces_user_updated_idx
  on public.picture_workspaces (tenant_id, user_id, updated_at desc);

create table if not exists public.picture_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.picture_workspaces(id) on delete cascade,
  kind text not null check (kind in ('generate', 'revise')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text not null,
  specification jsonb not null,
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  lease_owner text,
  lease_expires_at timestamptz,
  result_artifact_id uuid,
  model_info jsonb not null default '{}'::jsonb,
  cost_info jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  constraint picture_jobs_idempotency_key_check check (char_length(idempotency_key) between 1 and 180),
  constraint picture_jobs_specification_object_check check (jsonb_typeof(specification) = 'object'),
  constraint picture_jobs_lease_state_check check (
    status = 'running'
    or (lease_owner is null and lease_expires_at is null)
  ),
  constraint picture_jobs_terminal_time_check check (
    status not in ('succeeded', 'failed', 'cancelled')
    or completed_at is not null
  )
);

create unique index if not exists picture_jobs_workspace_idempotency_key
  on public.picture_jobs (workspace_id, idempotency_key);

create unique index if not exists picture_jobs_one_active_per_workspace
  on public.picture_jobs (workspace_id)
  where status in ('queued', 'running');

create index if not exists picture_jobs_claim_idx
  on public.picture_jobs (status, lease_expires_at, created_at)
  where status in ('queued', 'running');

alter table public.picture_workspaces
  drop constraint if exists picture_workspaces_current_job_id_fkey;

alter table public.picture_workspaces
  add constraint picture_workspaces_current_job_id_fkey
  foreign key (current_job_id) references public.picture_jobs(id) on delete set null
  deferrable initially deferred;

create or replace function public.touch_picture_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  if tg_table_name = 'picture_workspaces' then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists touch_picture_workspaces_updated_at on public.picture_workspaces;
create trigger touch_picture_workspaces_updated_at
before update on public.picture_workspaces
for each row execute function public.touch_picture_updated_at();

drop trigger if exists touch_picture_jobs_updated_at on public.picture_jobs;
create trigger touch_picture_jobs_updated_at
before update on public.picture_jobs
for each row execute function public.touch_picture_updated_at();

alter table public.validated_works
  add column if not exists artifact_id uuid,
  add column if not exists artifact_filename text,
  add column if not exists artifact_mime_type text,
  add column if not exists artifact_width integer,
  add column if not exists artifact_height integer;

alter table public.validated_works
  drop constraint if exists validated_works_artifact_type_check;

alter table public.validated_works
  add constraint validated_works_artifact_type_check
  check (artifact_type = any (array[
    'copy'::text,
    'campanha'::text,
    'briefing'::text,
    'insight'::text,
    'decisao'::text,
    'prompt'::text,
    'estrategia'::text,
    'peca_visual'::text
  ]));

alter table public.validated_works
  drop constraint if exists validated_works_visual_artifact_required;

alter table public.validated_works
  add constraint validated_works_visual_artifact_required
  check (
    artifact_type <> 'peca_visual'
    or (
      artifact_id is not null
      and artifact_filename is not null
      and char_length(artifact_filename) between 1 and 180
      and artifact_mime_type like 'image/%'
      and artifact_width > 0
      and artifact_height > 0
    )
  );

create unique index if not exists validated_works_artifact_id_unique
  on public.validated_works (artifact_id)
  where artifact_id is not null;

alter table public.picture_workspaces enable row level security;
alter table public.picture_workspaces force row level security;
alter table public.picture_jobs enable row level security;
alter table public.picture_jobs force row level security;

drop policy if exists "Users can read own picture workspaces" on public.picture_workspaces;
create policy "Users can read own picture workspaces"
on public.picture_workspaces
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can read own picture jobs" on public.picture_jobs;
create policy "Users can read own picture jobs"
on public.picture_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.picture_workspaces workspace
    where workspace.id = picture_jobs.workspace_id
      and workspace.user_id = (select auth.uid())
  )
);

revoke all on public.picture_workspaces from anon, authenticated;
revoke all on public.picture_jobs from anon, authenticated;
grant select on public.picture_workspaces to authenticated;
grant select on public.picture_jobs to authenticated;
grant all on public.picture_workspaces to service_role;
grant all on public.picture_jobs to service_role;

revoke all on function public.touch_picture_updated_at() from public;
grant execute on function public.touch_picture_updated_at() to service_role;
