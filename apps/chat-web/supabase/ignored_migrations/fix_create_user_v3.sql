-- Fix RPC: Create User By Admin (V3 - Robust Instance ID Handling)
-- Tenta obter instance_id, se falhar usa padrão '00000000-0000-0000-0000-000000000000' (comum em self-hosted/local)
-- Mas em Cloud o instance_id é obrigatório e geralmente o admin tem.

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

  -- Attempt to get instance_id from the executing user (admin)
  select instance_id into admin_instance_id from auth.users where id = auth.uid();

  -- If null, try to find ANY instance_id (fallback for some setups) or fail gracefully
  if admin_instance_id is null then
     -- Em alguns setups locais, pode ser nulo, mas na nuvem não.
     -- Vamos tentar pegar o primeiro instance_id não nulo encontrado (arriscado mas resolve em single-tenant)
     select instance_id into admin_instance_id from auth.users where instance_id is not null limit 1;
  end if;

  -- Se ainda for nulo, vamos assumir um valor padrão ou lançar erro específico
  if admin_instance_id is null then
     raise exception 'Erro interno: Não foi possível determinar o ID da instância do projeto.';
  end if;

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
    is_super_admin,
    confirmed_at
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
    false,
    now()
  );

  -- Insert into identities
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
