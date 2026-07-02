-- Shared ENS validated work memory.
-- Keeps generated artifacts audit-backed by user while preserving Hermes native memory.

create extension if not exists pgcrypto;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', constraint_name);
  end loop;
end $$;

update public.profiles
set role = case
  when role in ('admin', 'broker') then 'admin'
  when role = 'manager' then 'manager'
  else 'member'
end
where role is distinct from case
  when role in ('admin', 'broker') then 'admin'
  when role = 'manager' then 'manager'
  else 'member'
end;

alter table public.profiles alter column role set default 'member';
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'member'));

create or replace function public.current_app_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    'member'
  );
$$;

grant execute on function public.current_app_profile_role() to authenticated;

create or replace function public.admin_update_profile(
  target_user_id uuid,
  new_full_name text,
  new_avatar_url text,
  new_role text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  next_role text;
  updated_profile public.profiles;
begin
  actor_role := public.current_app_profile_role();
  if actor_role <> 'admin' then
    raise exception 'admin_required';
  end if;

  next_role := coalesce(nullif(trim(new_role), ''), null);
  if next_role is not null and next_role not in ('admin', 'manager', 'member') then
    raise exception 'invalid_profile_role';
  end if;

  update public.profiles
  set
    full_name = new_full_name,
    avatar_url = new_avatar_url,
    role = coalesce(next_role, role),
    updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;

create table if not exists public.validated_works (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'ens',
  artifact_type text not null check (artifact_type in ('copy', 'campanha', 'briefing', 'insight', 'decisao', 'prompt', 'estrategia')),
  title text not null check (char_length(title) between 1 and 180),
  content text not null check (char_length(content) between 1 and 30000),
  status text not null default 'validated' check (status in ('draft', 'validated', 'deprecated')),
  related_course_id text,
  related_course_title text,
  related_rag_source_id text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_name text,
  validated_by_user_id uuid references auth.users(id) on delete set null,
  validated_by_name text,
  validated_at timestamptz,
  deprecated_by_user_id uuid references auth.users(id) on delete set null,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists validated_works_tenant_status_type_idx
  on public.validated_works (tenant_id, status, artifact_type, validated_at desc);

create index if not exists validated_works_course_idx
  on public.validated_works (tenant_id, related_course_title);

create index if not exists validated_works_tags_idx
  on public.validated_works using gin (tags);

create or replace function public.touch_validated_works_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_validated_works_updated_at on public.validated_works;
create trigger touch_validated_works_updated_at
before update on public.validated_works
for each row execute function public.touch_validated_works_updated_at();

alter table public.validated_works enable row level security;

drop policy if exists "Validated works are readable by authenticated users" on public.validated_works;
create policy "Validated works are readable by authenticated users"
on public.validated_works
for select
to authenticated
using (
  status = 'validated'
  or public.current_app_profile_role() in ('admin', 'manager')
  or created_by_user_id = (select auth.uid())
);

drop policy if exists "Authenticated users can propose or validate own work" on public.validated_works;
create policy "Authenticated users can propose or validate own work"
on public.validated_works
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status in ('draft', 'validated')
);

drop policy if exists "Managers can update validated works" on public.validated_works;
create policy "Managers can update validated works"
on public.validated_works
for update
to authenticated
using (public.current_app_profile_role() in ('admin', 'manager'))
with check (public.current_app_profile_role() in ('admin', 'manager'));

drop policy if exists "Managers can delete validated works" on public.validated_works;
create policy "Managers can delete validated works"
on public.validated_works
for delete
to authenticated
using (public.current_app_profile_role() in ('admin', 'manager'));

grant select, insert, update, delete on public.validated_works to authenticated;
grant all on public.validated_works to service_role;
