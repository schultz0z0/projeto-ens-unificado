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
cd /opt/nexus-ens
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

## Delegação efêmera no Hermes

A Bridge envia a delegação da rodada por `system_message`, que a Session API trata como prompt efêmero. Imediatamente antes de executar uma tool Marketing Ops, o Hermes sobrescreve qualquer valor sugerido pelo modelo com a delegação desse turno. O SessionDB e os snapshots redigem `delegation_token` de `tool_calls` antes de persistir ou reapresentar o histórico. No startup do `hermes-api`, o scrubber remove blocos `[MARKETING_OPS_DELEGATION]` e redige valores aninhados gravados por versões antigas, sem apagar mensagens ou dados de domínio.

Após o primeiro deploy da correção, conferir o resultado sanitizado:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m hermes-api \
  | grep 'scrubbed persisted Marketing Ops delegations'
```

O primeiro startup pode informar uma quantidade maior que zero. Reinícios posteriores devem informar zero, salvo se uma versão antiga voltar a persistir blocos. O log contém somente a contagem, nunca o token. Falha do scrub interrompe o startup do `hermes-api` para evitar continuar com histórico técnico inseguro.

Validar conteúdo e argumentos sem exibir credenciais:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  /opt/hermes/.venv/bin/python - <<'PY'
import json
import sqlite3

REDACTED = "[REDACTED_EPHEMERAL_DELEGATION]"

def has_raw_delegation(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key).lower() == "delegation_token":
                return item != REDACTED
            if has_raw_delegation(item):
                return True
        return False
    if isinstance(value, list):
        return any(has_raw_delegation(item) for item in value)
    if isinstance(value, str) and "delegation_token" in value.lower():
        try:
            return has_raw_delegation(json.loads(value))
        except json.JSONDecodeError:
            return REDACTED not in value
    return False

db = sqlite3.connect("/opt/data/state.db")
rows = db.execute("select content, tool_calls from messages").fetchall()
unsafe = 0
for content, tool_calls in rows:
    marker = "[MARKETING_OPS_DELEGATION]" in (content or "")
    parsed = None
    if tool_calls:
        try:
            parsed = json.loads(tool_calls)
        except json.JSONDecodeError:
            parsed = tool_calls
    unsafe += int(marker or has_raw_delegation(parsed))
db.close()
print({"messages_with_raw_delegation": unsafe})
PY
```

Esperado: `messages_with_raw_delegation: 0`. A presença da chave com o valor `[REDACTED_EPHEMERAL_DELEGATION]` é segura e não deve ser contada como credencial bruta.

## Diagnóstico

- `/health`: processo HTTP vivo, sem consultar banco.
- `/ready`: conexão PostgreSQL disponível.
- `401`: bearer Supabase ou delegação inválida/expirada.
- `delegation_refresh_denied`: o token não pertence a uma run ativa ou o contexto não coincide; não relaxar essa proteção para aceitar tokens do histórico.
- `403`: membership, papel, scope, origin ou tenant negado.
- `409`: replay, idempotency key divergente ou version conflict.
- `503`: dependency/feature desabilitada.
