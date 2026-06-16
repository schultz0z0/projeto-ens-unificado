-- Comprehensive Fix for Login and Permissions
-- This script addresses:
-- 1. "Database error querying schema" by restoring standard schema permissions.
-- 2. Robust user creation by explicitly creating profiles and handling conflicts.
-- 3. Ensuring the 'authenticated' role has necessary access.

-- SECTION 1: RESTORE SCHEMA PERMISSIONS
-- Grant usage on public schema to all relevant roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant access to all tables in public to postgres and service_role (maintainer access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- Grant basic access to authenticated users (modify as needed for your specific security model)
-- Ideally, RLS handles the fine-grained control, but the role needs basic privileges first.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- SECTION 2: ROBUST CREATE USER FUNCTION (V5)
-- This replaces previous versions to ensure profile creation always happens.

create or replace function public.create_user_by_admin(email text, password text, full_name text)
returns uuid as $$
declare
  new_id uuid;
  admin_instance_id uuid;
begin
  -- Check admin permissions
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Acesso negado: Apenas administradores podem criar usuários.';
  end if;

  -- Attempt to get instance_id
  select instance_id into admin_instance_id from auth.users where id = auth.uid();
  
  -- Fallback logic for instance_id
  if admin_instance_id is null then
     select instance_id into admin_instance_id from auth.users where instance_id is not null limit 1;
  end if;
  
  new_id := gen_random_uuid();

  -- Insert into auth.users (using raw_app_meta_data for provider info)
  insert into auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data,
    raw_user_meta_data, 
    aud, 
    role,
    created_at,
    updated_at,
    last_sign_in_at,
    is_super_admin
  )
  values (
    new_id,
    admin_instance_id,
    email,
    crypt(password, gen_salt('bf')),
    now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    now(),
    false
  );

  -- Insert into auth.identities (Critical for Login)
  insert into auth.identities (
    id, 
    user_id, 
    identity_data, 
    provider, 
    provider_id, 
    last_sign_in_at, 
    created_at, 
    updated_at
  )
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

  -- EXPLICITLY create or update profile
  -- This runs as the admin (security definer), so it bypasses RLS for the insert/update
  insert into public.profiles (id, full_name, email, role)
  values (new_id, full_name, email, 'user')
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role;

  return new_id;
end;
$$ language plpgsql security definer;

-- SECTION 3: VERIFY RLS POLICIES
-- Ensure profiles are readable by the owner and admins (or everyone, depending on your needs)
-- We re-apply basic policies just in case.

alter table public.profiles enable row level security;

-- Policy: Users can read their own profile
drop policy if exists "Users can see own profile" on public.profiles;
create policy "Users can see own profile" on public.profiles
  for select using (auth.uid() = id);

-- Policy: Admins can see all profiles (Optional, if you want admins to see everything)
drop policy if exists "Admins can see all profiles" on public.profiles;
create policy "Admins can see all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Policy: Public/Everyone can read profiles (If your app requires it, e.g. for social features)
-- If not, keep it restricted. Based on "UserManagement", admins need to see everyone.
-- The previous setup had "Public profiles are viewable by everyone."
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

-- SECTION 4: GRANT EXECUTE ON RPC
grant execute on function public.create_user_by_admin to authenticated;
grant execute on function public.delete_user_by_admin to authenticated;
grant execute on function public.admin_reset_password to authenticated;

