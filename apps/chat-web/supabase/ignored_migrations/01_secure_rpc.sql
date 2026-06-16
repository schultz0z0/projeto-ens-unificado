-- MIGRATION 01: SECURE RPCs (Alternative to Edge Functions)
-- Motivo: Falta de acesso ao CLI Supabase para deploy de Edge Functions.
-- Solução: Funções PL/pgSQL com SECURITY DEFINER para gestão de usuários.

-- 1. FUNÇÃO: CRIAR USUÁRIO (ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
    email text,
    password text,
    full_name text
)
RETURNS uuid AS $$
DECLARE
  new_id uuid;
  admin_instance_id uuid;
  encrypted_pw text;
BEGIN
  -- 1. Validação de Permissão
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem criar usuários.';
  END IF;

  -- 2. Obter Instance ID (Necessário para multi-tenancy do Supabase, padrão é um UUID fixo ou nulo)
  SELECT instance_id INTO admin_instance_id FROM auth.users WHERE id = auth.uid();
  
  -- Fallback se não encontrar (comum em setups locais ou single-tenant)
  IF admin_instance_id IS NULL THEN
     SELECT instance_id INTO admin_instance_id FROM auth.users LIMIT 1;
  END IF;

  -- 3. Gerar ID e Hash de Senha
  new_id := gen_random_uuid();
  encrypted_pw := crypt(password, gen_salt('bf')); -- Requer extensão pgcrypto (já ativa no Supabase)

  -- 4. Inserir em auth.users
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
    is_super_admin
  )
  VALUES (
    new_id,
    admin_instance_id,
    email,
    encrypted_pw,
    now(), -- Email confirmado automaticamente
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    false
  );

  -- 5. Inserir em auth.identities (Essencial para login funcionar)
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
    new_id,
    jsonb_build_object('sub', new_id, 'email', email),
    'email',
    email,
    now(),
    now(),
    now()
  );

  -- 6. Inserir em public.profiles (Garantia de integridade)
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new_id, full_name, email, 'user')
  ON CONFLICT (id) DO UPDATE
  SET full_name = excluded.full_name,
      email = excluded.email;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNÇÃO: DELETAR USUÁRIO (ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- 1. Validação de Permissão
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- 2. Prevenir Auto-Deleção
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar sua própria conta.';
  END IF;

  -- 3. Deletar de auth.users (Cascade remove profiles e identities)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PERMISSÕES DE EXECUÇÃO
GRANT EXECUTE ON FUNCTION public.create_user_by_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin TO authenticated;

-- 4. REFRESHE CACHE
NOTIFY pgrst, 'reload config';
