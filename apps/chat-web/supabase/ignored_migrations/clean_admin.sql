
-- Script de Limpeza (Clean Slate)
-- Remove o usuário Admin atual para permitir recriação limpa pelo Dashboard.

BEGIN;

-- Remove da tabela de perfis
DELETE FROM public.profiles WHERE email = 'raphaeloliveira.atn@ens.edu.br';

-- Remove da tabela de identidades (por email ou provider_id)
DELETE FROM auth.identities WHERE email = 'raphaeloliveira.atn@ens.edu.br';
DELETE FROM auth.identities WHERE provider_id = 'raphaeloliveira.atn@ens.edu.br';

-- Remove da tabela de usuários
DELETE FROM auth.users WHERE email = 'raphaeloliveira.atn@ens.edu.br';

COMMIT;
