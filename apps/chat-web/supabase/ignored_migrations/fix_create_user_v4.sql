-- Fix RPC: Create User By Admin (V4 - Fix Generated Column Error)
-- Erro anterior: "cannot insert a non-DEFAULT value into column confirmed_at"
-- Motivo: 'confirmed_at' é uma coluna gerada automaticamente (GENERATED ALWAYS AS) nas versões recentes do Auth.
-- Solução: Remover 'confirmed_at' do INSERT e confiar no 'email_confirmed_at'.

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

  if admin_instance_id is null then
     raise exception 'Erro interno: Não foi possível determinar o ID da instância do projeto.';
  end if;

  new_id := gen_random_uuid();

  -- Insert into auth.users
  -- REMOVIDO: confirmed_at (é gerado automaticamente)
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
    now(), -- email_confirmed_at garante que o usuário está confirmado
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    now(),
    false
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
