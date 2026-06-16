-- Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  full_name text,
  role text default 'user' check (role in ('user', 'admin')),
  email text -- storing email in profiles for easier search by admin
);

-- Enable RLS
alter table public.profiles enable row level security;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE (full_name, updated_at) ON public.profiles TO authenticated;

-- Policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Trigger for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email,
    'user'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid error on multiple runs
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RPC: Admin Reset Password (Option B)
-- Note: Directly updating auth.users is not recommended but is the only SQL-only way without Edge Functions.
create or replace function public.admin_reset_password(target_user_id uuid, new_password text)
returns void as $$
begin
  -- Check if executing user is admin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Apenas administradores podem redefinir senhas.';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf'))
  where id = target_user_id;
end;
$$ language plpgsql security definer;

-- RPC: Create User By Admin
create or replace function public.create_user_by_admin(email text, password text, full_name text)
returns uuid as $$
declare
  new_id uuid;
begin
  -- Check admin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Not authorized';
  end if;

  new_id := gen_random_uuid();

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  values (
    new_id,
    email,
    crypt(password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated'
  );

  -- Insert into identities to allow login (crucial for Supabase Auth)
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(),
    new_id,
    jsonb_build_object('sub', new_id, 'email', email),
    'email',
    email,
    now(),
    now(),
    now()
  );

  return new_id;
end;
$$ language plpgsql security definer;
