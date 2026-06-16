-- FIX PERMISSIONS V7 (FINAL)
-- O erro "Database error querying schema" (HTTP 500 na rota /token) indica que o PostgREST
-- (a camada de API do Supabase) não consegue sequer iniciar a query no schema 'public'.
-- Isso ocorre quando o role 'authenticated' (ou 'anon') perdeu o privilégio USAGE no schema.

-- 1. Garantir USAGE no schema public
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Garantir acesso a TODAS as tabelas atuais
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Garantir acesso a SEQUÊNCIAS (para inserts funcionarem)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Garantir acesso a FUNÇÕES (para RPCs funcionarem)
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- 5. ALTERAR O DEFAULT PRIVILEGES
-- Isso garante que NOVAS tabelas criadas no futuro também tenham essas permissões.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

-- 6. Verificação de integridade (Opcional, mas útil para debug)
-- Se o erro persistir, significa que o PostgREST cacheou as permissões antigas.
-- A única forma de limpar o cache do PostgREST via SQL é fazendo um NOTIFY pgrst.
NOTIFY pgrst, 'reload config';
