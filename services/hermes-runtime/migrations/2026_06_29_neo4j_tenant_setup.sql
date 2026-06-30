-- =============================================================================
-- Migration: Neo4j multi-tenant setup + Supabase JWT tenant_id
-- Data: 2026-06-29
-- Versao: v3.7+ (white-label multi-tenant)
-- Descricao: Prepara o Supabase do cliente para integrar com Neo4j multi-tenant
--
-- SEGURANCA: Todas as statements usam IF NOT EXISTS ou verificam antes.
--            Pode rodar multiplas vezes sem efeito colateral.
--
-- ROLLBACK: Veja arquivo 2026_06_29_neo4j_tenant_setup.rollback.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 1: Adicionar coluna tenant_id em profiles
-- =============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id
ON public.profiles(tenant_id);

-- Backfill: setar 'ens' pra todos os perfis existentes
UPDATE public.profiles
SET tenant_id = 'ens'
WHERE tenant_id IS NULL;

COMMENT ON COLUMN public.profiles.tenant_id IS
  'White-label tenant identifier. ENS=1 (cliente 1). Padrao: ens para perfis existentes.';

-- =============================================================================
-- MIGRATION 2: Setar tenant_id nos usuarios existentes do Supabase Auth
-- =============================================================================

-- 6 usuarios da ENS -> tenant_id = 'ens'
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{tenant_id}',
  '"ens"'
)
WHERE email IN (
  'claudia.am4@ens.edu.br',
  'rodrigolinhares@ens.edu.br',
  'mariaclarachagas@ens.edu.br',
  'ricardomota@ens.edu.br',
  'thiago.am4@ens.edu.br',
  'raphaeloliveira.atn@ens.edu.br'
);

-- 1 usuario de QA -> tenant_id = 'qa'
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{tenant_id}',
  '"qa"'
)
WHERE email = 'qa_tester@nexus.ai';

-- (Opcional) Validacao: mostra todos os usuarios com seus tenants
SELECT email, raw_user_meta_data->>'tenant_id' AS tenant
FROM auth.users
ORDER BY tenant DESC, email;

-- =============================================================================
-- NOTA SOBRE MIGRATION 3: Atualizar handle_new_user
-- =============================================================================
-- Migration 3 NAO incluida neste arquivo porque handle_new_user (auth)
-- pode ter logica customizada que NAO devemos alterar sem ler antes.
--
-- Para rodar Migration 3:
-- 1. Primeiro: SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
-- 2. Cole o conteudo aqui nesta conversa
-- 3. Eu te mando CREATE OR REPLACE FUNCTION ... com +tenant_id
--
-- Enquanto isso, novos signups NAO terao tenant_id automatico.
-- Workaround: setar manualmente via Dashboard apos signup.
-- =============================================================================

-- =============================================================================
-- MIGRATION 4: Index composto em profiles(tenant_id, id) — performance
-- =============================================================================

-- (Opcional, ja temos o idx_profiles_tenant_id acima)
-- Esse otimiza queries tipo "SELECT * FROM profiles WHERE tenant_id=X AND id=Y"
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id_id
ON public.profiles(tenant_id, id);

-- =============================================================================
-- VALIDACAO POS-MIGRATION
-- =============================================================================

-- Rodar depois pra confirmar:
-- 1. SELECT email, raw_user_meta_data->>'tenant_id' FROM auth.users;
--    Deve mostrar: 7 usuarios, 6 com 'ens', 1 com 'qa'.

-- 2. SELECT COUNT(*) FROM public.profiles WHERE tenant_id = 'ens';
--    Deve mostrar: numero de profiles existentes (todos com tenant_id setado).

-- 3. (Testar JWT) Em um frontend login, fazer:
--    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
--    console.log(payload.user_metadata?.tenant_id);
--    Esperado: "ens"

-- =============================================================================
-- ROLLBACK (executar SOMENTE se algo der errado):
-- DROP INDEX IF EXISTS idx_profiles_tenant_id;
-- DROP INDEX IF EXISTS idx_profiles_tenant_id_id;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS tenant_id;
--
-- Para remover tenant_id dos usuarios:
-- UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'tenant_id';
-- =============================================================================
