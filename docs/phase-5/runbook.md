# Runbook de deploy — Fase 5

- **Estado:** `ready_for_execution`
- **Escopo:** deploy da aplicação; Supabase já implantado
- **Checkout esperado na VPS:** `/opt/nexus-ens`, branch `main`

## 1. Pré-deploy

Publique primeiro o commit local no GitHub. Na VPS:

```bash
cd /opt/nexus-ens
set -euo pipefail
git status --short
git pull --ff-only origin main
git rev-parse --short HEAD
```

Pare se houver alteração local inesperada ou se o SHA não for o commit
informado pelo responsável.

## 2. Flags e secrets

Sem imprimir valores sensíveis, confirme as configurações existentes e acrescente
as duas flags e os dois parâmetros do worker à `.env`:

```bash
chmod 600 .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_READ=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_WRITE=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_ENABLED=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_READ=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_WRITE=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH=false$' .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_APPROVALS=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_APPROVALS=true$' .env
grep -q '^NEXUS_MARKETING_OPS_APPROVAL_EXPIRY_INTERVAL_MS=30000$' .env
grep -q '^NEXUS_MARKETING_OPS_APPROVAL_EXPIRY_BATCH_SIZE=100$' .env
```

Se as quatro últimas ainda não existirem, edite `.env` e adicione:

```text
NEXUS_MARKETING_OPS_FEATURE_APPROVALS=true
NEXUS_MARKETING_OPS_FRONTEND_APPROVALS=true
NEXUS_MARKETING_OPS_APPROVAL_EXPIRY_INTERVAL_MS=30000
NEXUS_MARKETING_OPS_APPROVAL_EXPIRY_BATCH_SIZE=100
```

Não exiba `DATABASE_URL`, service-role keys, chaves Hermes, internas ou de
delegação. A flag `FRONTEND_APPROVALS` é resolvida no build.

## 3. Validar e construir

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache marketing-ops app-frontend app-bridge hermes-api
```

## 4. Recriar somente os serviços afetados

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate marketing-ops app-frontend app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps marketing-ops app-frontend app-bridge hermes-api
```

Não use `docker compose down`, `--remove-orphans` ou remoção de volumes.

## 5. Health, discovery e skill

```bash
curl -fsS http://127.0.0.1:8091/ready
curl -fsS http://127.0.0.1:8088/
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8652/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_marketing_ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api sh -lc 'grep -q "^version: 1.3.0$" /opt/data/skills/marketing/marketing-ops-operator/SKILL.md'
```

Confirme pela capability autenticada que `governanceApprovalsV1` está ativo e
abra `/marketing-ops/approvals` após login. Não copie tokens para evidências.

## 6. Logs e estabilidade

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=10m --tail=300 marketing-ops app-frontend app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml restart marketing-ops app-frontend app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps marketing-ops app-frontend app-bridge hermes-api
curl -fsS http://127.0.0.1:8091/ready
```

Procure 5xx, loops, payloads integrais, comentários, tokens ou secrets. Registre
somente timestamp, correlation ID, código e resultado seguro.

## 7. Entrega ao assistente

Informe:

- SHA implantado;
- URL pública;
- resultado dos quatro health checks e MCP discovery;
- confirmação das duas flags e dos dois parâmetros do worker;
- contas de homologação member/manager/admin ou sessão já autenticada;
- autorização para o assistente abrir o site.

O assistente então executará `vps-validation.md`. A fase não é considerada
concluída antes desse aceite.
