begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

select has_column('public', 'chat_sessions', 'session_kind', 'chat sessions classify normal and picture experiences');
select col_default_is('public', 'chat_sessions', 'session_kind', 'normal'::text, 'chat sessions default to normal');
select has_table('public', 'picture_workspaces', 'picture workspaces table exists');
select has_table('public', 'picture_jobs', 'picture jobs table exists');
select has_pk('public', 'picture_workspaces', 'picture workspaces have a primary key');
select has_pk('public', 'picture_jobs', 'picture jobs have a primary key');

select has_column('public', 'picture_workspaces', 'chat_session_id', 'workspace binds a chat session');
select has_column('public', 'picture_workspaces', 'candidate_artifact_id', 'workspace tracks current candidate');
select has_column('public', 'picture_workspaces', 'validated_artifact_id', 'workspace tracks promoted final');
select has_column('public', 'picture_workspaces', 'validated_work_id', 'workspace links validated work');
select has_column('public', 'picture_jobs', 'lease_expires_at', 'jobs persist worker leases');
select has_column('public', 'picture_jobs', 'specification', 'jobs persist immutable specifications');

select has_index('public', 'picture_workspaces', 'picture_workspaces_one_active_per_user', 'only one active workspace per user and tenant');
select has_index('public', 'picture_jobs', 'picture_jobs_workspace_idempotency_key', 'job enqueue is idempotent per workspace');
select has_index('public', 'picture_jobs', 'picture_jobs_one_active_per_workspace', 'jobs serialize within a workspace');

select has_column('public', 'validated_works', 'artifact_id', 'validated works can reference artifact bytes');
select has_column('public', 'validated_works', 'artifact_filename', 'validated visual work stores filename');
select has_column('public', 'validated_works', 'artifact_mime_type', 'validated visual work stores content type');
select has_column('public', 'validated_works', 'artifact_width', 'validated visual work stores width');
select has_column('public', 'validated_works', 'artifact_height', 'validated visual work stores height');
select has_index('public', 'validated_works', 'validated_works_artifact_id_unique', 'an artifact maps to at most one validated work');

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.picture_workspaces'::regclass),
  'picture workspaces force RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.picture_jobs'::regclass),
  'picture jobs force RLS'
);
select ok(has_table_privilege('authenticated', 'public.picture_workspaces', 'SELECT'), 'authenticated can read allowed workspaces');
select ok(not has_table_privilege('authenticated', 'public.picture_workspaces', 'INSERT'), 'authenticated cannot create workspaces directly');
select ok(has_table_privilege('service_role', 'public.picture_jobs', 'SELECT,INSERT,UPDATE,DELETE'), 'service role operates picture jobs');

select throws_ok(
  $$insert into public.validated_works (
      artifact_type, title, content, status
    ) values (
      'peca_visual', 'Peça sem arquivo', 'Descrição', 'validated'
    )$$,
  '23514',
  null,
  'visual work requires artifact metadata'
);

select * from finish();

rollback;
