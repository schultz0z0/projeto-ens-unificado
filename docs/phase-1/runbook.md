# Runbook da Fase 1

## Ambientes

| Ambiente | Sistema | Runtime |
|---|---|---|
| Desenvolvimento | Windows + PowerShell | Docker Desktop, Supabase CLI e Node 22 |
| Produção | Ubuntu Linux na VPS | Docker Engine/Compose, checkout Git e Traefik existente |

O `.env` da raiz é a fonte global. Marketing Ops usa `NEXUS_APP_SUPABASE_*` e `NEXUS_SUPABASE_DATABASE_URL`; RAG continua usando somente `NEXUS_RAG_SUPABASE_*`.

## Desenvolvimento Windows

```powershell
Set-Location 'D:\Projetos SaaS\Projeto-ens-unificado\apps\chat-web'
npx supabase start
npx supabase db reset --local
npx supabase test db --local supabase/tests

Set-Location '..\..'
$env:NEXUS_SUPABASE_DATABASE_URL='postgresql://postgres:postgres@host.docker.internal:54322/postgres'
$env:NEXUS_APP_SUPABASE_URL='http://host.docker.internal:54321'
$env:NEXUS_MARKETING_OPS_INTERNAL_KEY='local-development-internal-key-32-bytes'
$env:NEXUS_MARKETING_OPS_DELEGATION_ACTIVE_KID='local-v1'
$env:NEXUS_MARKETING_OPS_DELEGATION_ACTIVE_KEY='local-development-delegation-key-32-bytes'
docker compose --env-file .env build marketing-ops
docker compose --env-file .env up -d marketing-ops
Invoke-RestMethod http://127.0.0.1:8091/health
Invoke-RestMethod http://127.0.0.1:8091/ready
```

`127.0.0.1` é usado pelo host; containers acessam o Supabase local por `host.docker.internal`. Não copiar credenciais locais para a VPS.

## Deploy Supabase do app

Antes de containers novos, gerar backup externo, hash e diff conforme `supabase-baseline.md`. Na primeira adoção do baseline, reparar o histórico somente depois da equivalência de schema.

```bash
cd apps/chat-web
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase db lint --linked --level error --fail-on error
npx supabase db advisors --linked --type security --fail-on error
```

Nunca executar esses comandos com projeto/ref/URL do Supabase RAG.

## Deploy VPS Ubuntu

```bash
cd /opt/projeto-ens-unificado
git pull --ff-only
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops app-bridge hermes-api hermes-kanban app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d marketing-ops hermes-api hermes-kanban app-bridge app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8091/health
curl -fsS http://127.0.0.1:8091/ready
```

Depois do smoke interno, validar `https://ops.solucoes-nexus.tech/health`, autenticação REST e uma tool MCP via Hermes. Registrar saída sanitizada em `vps-validation.md`.

## Rollout

1. Subir com leitura/escrita e frontend `false`.
2. Ativar `NEXUS_MARKETING_OPS_FEATURE_READ=true`; recriar `marketing-ops`.
3. Validar REST/MCP de leitura.
4. Ativar `NEXUS_MARKETING_OPS_FEATURE_WRITE=true`; validar idempotência/rollback.
5. Ativar flags frontend somente quando uma tela de fase posterior existir.
6. `NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH=true` desliga a superfície cliente no próximo build.

## Chaves de delegação

Gerar segredo aleatório de no mínimo 32 bytes. Bridge emite somente `ACTIVE`; Marketing Ops aceita `ACTIVE` e `PREVIOUS`. Para rotação: promover chave nova para active, manter a antiga como previous por pelo menos 120 segundos, reiniciar Bridge/Marketing Ops e então remover previous.

## Diagnóstico

- `/health`: processo HTTP vivo, sem consultar banco.
- `/ready`: conexão PostgreSQL disponível.
- `401`: bearer Supabase ou delegação inválida/expirada.
- `403`: membership, papel, scope, origin ou tenant negado.
- `409`: replay, idempotency key divergente ou version conflict.
- `503`: dependency/feature desabilitada.
