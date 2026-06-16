-- Fix RPC: Create User By Admin with correct Instance ID
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

  -- Get the instance_id of the admin user (ensures the new user is created in the same project instance)
  select instance_id into admin_instance_id from auth.users where id = auth.uid();

  -- Fallback if null (shouldn't happen in hosted Supabase)
  if admin_instance_id is null then
     raise exception 'Could not determine instance_id';
  end if;

  new_id := gen_random_uuid();

  -- Insert into auth.users with explicit instance_id
  insert into auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_user_meta_data, 
    aud, 
    role
  )
  values (
    new_id,
    admin_instance_id,
    email,
    crypt(password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated'
  );

  -- Insert into identities (Required for login)
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
