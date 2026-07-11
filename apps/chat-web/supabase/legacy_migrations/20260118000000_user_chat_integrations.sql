-- Persist dynamic Hermes endpoint overrides per user.
create table if not exists public.user_chat_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hermes_enabled boolean not null default false,
  hermes_base_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint user_chat_integrations_base_url_https_check check (
    hermes_base_url is null
    or btrim(hermes_base_url) = ''
    or hermes_base_url ~ '^https://[^[:space:]]+$'
  )
);

alter table public.user_chat_integrations enable row level security;

grant select on public.user_chat_integrations to authenticated;
grant all on public.user_chat_integrations to service_role;

drop policy if exists "Users can view own chat integration" on public.user_chat_integrations;
create policy "Users can view own chat integration"
  on public.user_chat_integrations
  for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admins can insert chat integrations" on public.user_chat_integrations;
create policy "Admins can insert chat integrations"
  on public.user_chat_integrations
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update chat integrations" on public.user_chat_integrations;
create policy "Admins can update chat integrations"
  on public.user_chat_integrations
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete chat integrations" on public.user_chat_integrations;
create policy "Admins can delete chat integrations"
  on public.user_chat_integrations
  for delete
  using (public.is_admin());

create or replace function public.admin_upsert_user_chat_integration(
  target_user_id uuid,
  new_hermes_enabled boolean,
  new_hermes_base_url text default null
)
returns public.user_chat_integrations
language plpgsql
security definer
as $$
declare
  normalized_url text;
  result_row public.user_chat_integrations;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem configurar a integracao Hermes.';
  end if;

  normalized_url := nullif(btrim(coalesce(new_hermes_base_url, '')), '');

  if new_hermes_enabled and normalized_url is null then
    raise exception 'Informe uma base URL HTTPS valida para habilitar o endpoint Hermes personalizado.';
  end if;

  if normalized_url is not null and normalized_url !~ '^https://[^[:space:]]+$' then
    raise exception 'A base URL do Hermes deve usar HTTPS.';
  end if;

  insert into public.user_chat_integrations (
    user_id,
    hermes_enabled,
    hermes_base_url,
    updated_at,
    updated_by
  )
  values (
    target_user_id,
    new_hermes_enabled,
    case when new_hermes_enabled then normalized_url else null end,
    now(),
    auth.uid()
  )
  on conflict (user_id) do update
  set hermes_enabled = excluded.hermes_enabled,
      hermes_base_url = excluded.hermes_base_url,
      updated_at = now(),
      updated_by = auth.uid()
  returning * into result_row;

  return result_row;
end;
$$;

grant execute on function public.admin_upsert_user_chat_integration(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
