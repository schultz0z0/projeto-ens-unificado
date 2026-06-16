-- Fix RPC: Create User By Admin (V2 - Complete Metadata)
-- Fixes "Database error querying schema" by ensuring all auth metadata is present.

create or replace function public.create_user_by_admin(email text, password text, full_name text)
returns uuid as $$
declare
  new_id uuid;
  admin_instance_id uuid;
begin
  -- Check admin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Not authorized';
  end if;

  -- Get the instance_id of the admin user
  select instance_id into admin_instance_id from auth.users where id = auth.uid();

  if admin_instance_id is null then
     raise exception 'Could not determine instance_id';
  end if;

  new_id := gen_random_uuid();

  -- Insert into auth.users with COMPLETE metadata
  -- raw_app_meta_data is crucial for GoTrue to recognize the provider
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
    is_super_admin,
    confirmed_at
  )
  values (
    new_id,
    admin_instance_id,
    email,
    crypt(password, gen_salt('bf')),
    now(), -- email_confirmed_at
    '{"provider":"email","providers":["email"]}', -- raw_app_meta_data
    jsonb_build_object('full_name', full_name), -- raw_user_meta_data
    'authenticated',
    'authenticated',
    now(),
    now(),
    now(),
    false,
    now() -- confirmed_at
  );

  -- Insert into identities
  -- Note: We use the email as provider_id
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

  return new_id;
end;
$$ language plpgsql security definer;
