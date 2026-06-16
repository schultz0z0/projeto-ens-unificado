
-- Script DEFINITIVO para correção do Admin
-- Este script remove qualquer vestígio do usuário e o recria do zero.

BEGIN;

-- 1. Limpeza Profunda (Ordem importa por causa das chaves estrangeiras)
-- Remove da tabela de perfis (se houver orfão)
DELETE FROM public.profiles WHERE email = 'raphaeloliveira.atn@ens.edu.br';

-- Remove da tabela de identidades (se houver)
DELETE FROM auth.identities WHERE email = 'raphaeloliveira.atn@ens.edu.br'; -- email não é coluna padrão aqui, mas o provider_id é geralmente o email para provider 'email'
DELETE FROM auth.identities WHERE provider_id = 'raphaeloliveira.atn@ens.edu.br'; 

-- Remove da tabela de usuários (auth.users)
DELETE FROM auth.users WHERE email = 'raphaeloliveira.atn@ens.edu.br';

COMMIT;

-- 2. Recriação do Usuário
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  target_email text := 'raphaeloliveira.atn@ens.edu.br';
  target_password text := 'admin';
  target_name text := 'Admin';
BEGIN
  -- Inserir em auth.users
  INSERT INTO auth.users (
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
    confirmation_token,
    recovery_token
  )
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    target_email,
    crypt(target_password, gen_salt('bf')), -- Senha criptografada
    now(), -- email confirmado
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', target_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    ''
  );

  -- Inserir em auth.identities (CRUCIAL para o login funcionar)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', target_email),
    'email',
    target_email, -- O provider_id DEVE ser o email
    now(),
    now(),
    now()
  );

  -- Inserir em public.profiles (Se o trigger não tiver rodado)
  -- Usamos ON CONFLICT para garantir que se o trigger rodou, nós apenas atualizamos o role
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new_user_id, target_name, target_email, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', full_name = target_name;

END $$;
