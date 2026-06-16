-- MIGRATION 00: MASTER SETUP (Clean Slate)
-- Autor: Trae AI
-- Data: 2025-12-02
-- Descrição: Configuração completa de tabelas, segurança e funções auxiliares.

-- 1. LIMPEZA (Caso existam resquícios)
DROP FUNCTION IF EXISTS public.is_admin();
DROP TABLE IF EXISTS public.generated_images;
DROP TABLE IF EXISTS public.profiles;

-- 2. TABELAS

-- 2.1 Profiles (Dados públicos do usuário)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Generated Images (Para integração N8N)
CREATE TABLE public.generated_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUNÇÕES AUXILIARES (SECURITY DEFINER)

-- 3.1 is_admin() - Verifica se o usuário atual é admin sem causar recursão no RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ROW LEVEL SECURITY (RLS)

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- 4.1 Políticas para PROFILES

-- Leitura Pública (Evita erro no login e permite carregar perfis básicos)
CREATE POLICY "Public Read Profiles" ON public.profiles
    FOR SELECT USING (true);

-- Atualização: Apenas o dono pode atualizar seu perfil
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Inserção: Apenas o dono (ou Service Role via Edge Function)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 4.2 Políticas para GENERATED_IMAGES

-- Leitura: Usuário vê as suas, Admin vê todas
CREATE POLICY "Users view own images" ON public.generated_images
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Inserção: Usuário cria para si mesmo
CREATE POLICY "Users insert own images" ON public.generated_images
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Deleção: Usuário deleta as suas, Admin deleta qualquer uma
CREATE POLICY "Users delete own images" ON public.generated_images
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- 5. PERMISSÕES (GRANTS) - CRÍTICO PARA EVITAR ERRO 500

-- Schema PUBLIC
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Authenticated Users (Acesso padrão)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Anon Users (Acesso limitado, leitura necessária para login em alguns casos)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Schema AUTH (Necessário para Service Role funcionar 100%)
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO service_role;

-- 6. CONFIGURAÇÃO PADRÃO (DEFAULT PRIVILEGES)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- 7. RECARREGAR CACHE
NOTIFY pgrst, 'reload config';

-- --- FIM DA MIGRAÇÃO ---
