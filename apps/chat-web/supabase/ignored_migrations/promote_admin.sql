-- promote_admin.sql
-- Este script promove o usuário criado manualmente para o cargo de 'admin'

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- 1. Buscar o ID do usuário na tabela auth.users (criado manualmente no painel)
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'raphaeloliveira.atn@ens.edu.br';

  -- 2. Verificar se o usuário existe
  IF target_user_id IS NOT NULL THEN
    -- 3. Inserir ou atualizar o perfil em public.profiles
    INSERT INTO public.profiles (id, email, full_name, role, updated_at)
    VALUES (
      target_user_id, 
      'raphaeloliveira.atn@ens.edu.br', 
      'Admin', 
      'admin',
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        full_name = 'Admin',
        updated_at = now();
        
    RAISE NOTICE 'Usuário promovido a ADMIN com sucesso!';
  ELSE
    RAISE EXCEPTION 'ERRO: Usuário raphaeloliveira.atn@ens.edu.br não encontrado. Por favor, crie o usuário manualmente no menu Authentication > Users antes de rodar este script.';
  END IF;
END $$;
