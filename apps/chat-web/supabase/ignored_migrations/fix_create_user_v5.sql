-- Fix RPC: Create User By Admin (V5 - Final Robustness)
-- Changes:
-- 1. Explicitly inserts into public.profiles to guarantee profile creation (handling trigger failures or race conditions).
-- 2. Uses ON CONFLICT to play nicely with existing triggers.
-- 3. Grants explicit permissions to ensure schema access.

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
  
  -- Fallback logic
  if admin_instance_id is null then
     select instance_id into admin_instance_id from auth.users where instance_id is not null limit 1;
  end if;

  -- If still null, we proceed. In some Supabase environments, instance_id might be optional or inferred.
  -- However, to be safe for the insert, we only use it if found.
  
  new_id := gen_random_uuid();

  -- Insert into auth.users
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

  -- Insert into auth.identities
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

  -- EXPLICITLY create profile to ensure it exists and avoid "Database error querying schema" due to missing relations
  insert into public.profiles (id, full_name, email, role)
  values (new_id, full_name, email, 'user')
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role;

  return new_id;
end;
$$ language plpgsql security definer;

-- Grant permissions to ensure no schema access errors
grant usage on schema public to anon, authenticated;
grant all on public.profiles to postgres, service_role;
