create table if not exists public.chat_session_hermes_state (
  chat_session_id uuid primary key references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hermes_session_id text,
  hermes_conversation_id text not null,
  last_response_id text,
  last_good_response_id text,
  chain_health text not null default 'healthy' check (chain_health in ('healthy', 'degraded', 'recovering')),
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists chat_session_hermes_state_user_id_idx
  on public.chat_session_hermes_state (user_id);

create index if not exists chat_session_hermes_state_hermes_session_id_idx
  on public.chat_session_hermes_state (hermes_session_id);

alter table public.chat_session_hermes_state enable row level security;

drop policy if exists "Users can view their own Hermes chat state" on public.chat_session_hermes_state;
create policy "Users can view their own Hermes chat state"
  on public.chat_session_hermes_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own Hermes chat state" on public.chat_session_hermes_state;
create policy "Users can insert their own Hermes chat state"
  on public.chat_session_hermes_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Hermes chat state" on public.chat_session_hermes_state;
create policy "Users can update their own Hermes chat state"
  on public.chat_session_hermes_state
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own Hermes chat state" on public.chat_session_hermes_state;
create policy "Users can delete their own Hermes chat state"
  on public.chat_session_hermes_state
  for delete
  using (auth.uid() = user_id);

create or replace function public.touch_chat_session_hermes_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_chat_session_hermes_state_updated_at on public.chat_session_hermes_state;
create trigger touch_chat_session_hermes_state_updated_at
before update on public.chat_session_hermes_state
for each row
execute function public.touch_chat_session_hermes_state_updated_at();
