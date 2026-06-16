-- FIX: PROTEÇÃO DE DADOS DE USUÁRIO (PRIVACIDADE)
-- Data: 2025-12-10
-- Autor: Auditor de Segurança (Trae AI)
-- Severidade: CRÍTICA
-- Descrição: Remove o acesso público irrestrito à tabela de perfis (que expunha e-mails) e restringe a leitura apenas ao próprio usuário e administradores.

BEGIN;

-- 1. Remover a política excessivamente permissiva
DROP POLICY IF EXISTS "Public Read Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public Read Access" ON public.profiles;

-- 2. Criar política restritiva para leitura
-- Usuários podem ver APENAS seu próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- 3. Permitir que Admins vejam todos os perfis
-- (Assumindo que a função is_admin() já existe e é segura)
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT
    USING (public.is_admin());

-- 4. Garantir que a tabela generated_images também esteja segura (reforço)
DROP POLICY IF EXISTS "Users view own images" ON public.generated_images;
CREATE POLICY "Users view own images" ON public.generated_images
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- 5. Revogar permissões desnecessárias do role 'anon' (Visitante não logado)
-- Por padrão, anon não deve conseguir fazer SELECT direto nas tabelas, deve usar RPCs se necessário
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.generated_images FROM anon;

REVOKE EXECUTE ON FUNCTION public.insecure_reset_password(text, text, text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.insecure_reset_password(text, text, text);

COMMIT;

-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- Tente fazer um SELECT na tabela profiles como anonimo (deve falhar ou retornar vazio)
-- Tente fazer um SELECT como usuário autenticado (deve retornar apenas 1 linha)
