# Runbook da Fase 3

- **Estado:** `ready_for_vps_execution`
- **Implementação:** `implementation_complete_pending_vps_validation`
- **Supabase do app:** migrations aplicadas e invariantes validadas
- **Produção:** Ubuntu Linux + Docker Engine/Compose + Traefik
- **Checkout VPS esperado:** `/opt/nexus-ens`; confirmar antes do deploy

## Responsabilidades

| Ação | Responsável |
|---|---|
| Implementação, testes locais, Docker, documentação e commit em `main` | agente |
| Publicar `main` no GitHub | usuário |
| Aplicar migrations no Supabase do app após backup/dry-run | agente, concluído |
| Rotacionar a senha do banco e atualizar o `.env` da VPS | usuário |
| Deploy e validação manual na VPS | usuário, com análise do agente |

## Bloqueador pré-deploy: rotação de credencial

Uma senha de banco apareceu acidentalmente na saída do terminal durante o
diagnóstico do deploy Supabase. Ela não foi gravada no repositório nem nesta
documentação, mas deve ser considerada exposta.

Antes do deploy:

1. rotacionar a senha do banco do projeto Supabase do app;
2. atualizar `NEXUS_SUPABASE_DB_PASSWORD` e
   `NEXUS_SUPABASE_DATABASE_URL` no `.env` local seguro e na VPS;
3. confirmar que a URL continua usando o Session Pooler IPv4, porta `5432`;
4. executar `chmod 600 .env` na VPS;
5. recriar imediatamente o Marketing Ops para reduzir a janela entre a rotação
   e a aplicação da nova credencial.

Nunca imprimir o `.env`, a URL completa do banco ou a senha em evidências.

## Publicação do `main`

No computador local:

```powershell
git status --short --branch
git log -3 --oneline
git push origin main
git status --short --branch
```

O resultado esperado é `main` sincronizado com `origin/main`, sem arquivos
modificados.

## Conferência segura do `.env` na VPS

Confirmar, sem exibir valores:

```bash
cd /opt/nexus-ens
chmod 600 .env
grep -q '^NEXUS_SUPABASE_DATABASE_URL=.' .env
grep -q '^NEXUS_APP_SUPABASE_URL=https://' .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_READ=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_WRITE=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_ENABLED=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_READ=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_WRITE=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH=false$' .env
```

Também devem estar definidos com valores fortes/não-placeholder:

- `NEXUS_MARKETING_OPS_INTERNAL_KEY`;
- `NEXUS_MARKETING_OPS_DELEGATION_ACTIVE_KEY`;
- `NEXUS_ARTIFACT_INTERNAL_KEY`;
- `NEXUS_ARTIFACT_ACCESS_TOKEN_SECRET`;
- URLs públicas HTTPS de Marketing Ops e Artifact Server;
- allowlists CORS das origens públicas reais.

## Atualização do checkout

```bash
cd /opt/nexus-ens
git status --short --branch
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
git status --short --branch
```

Pare se houver mudança local inesperada. Não use `reset --hard` para
descartá-la.

## Build e deploy

Para o primeiro deploy completo da Fase 3, use `--pull --no-cache` nos quatro
alvos. O frontend possui flags `VITE_*` embutidas no build e o Marketing Ops
recebeu mudanças de contrato/observabilidade; o build limpo evita reutilizar
camadas anteriores. `--no-cache` é recomendado neste deploy, não como regra
permanente.

```bash
cd /opt/nexus-ens
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --pull --no-cache marketing-ops artifact-server rag-mcp app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate artifact-server rag-mcp marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

Não executar `supabase db reset`, `supabase db push` nem down migration na VPS:
as migrations do app já foram aplicadas e verificadas no Supabase remoto.

## Probes imediatos

```bash
curl -fsS http://127.0.0.1:8095/health
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8091/health
curl -fsS http://127.0.0.1:8091/ready
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=15m --no-color marketing-ops artifact-server rag-mcp app-frontend
```

Esperado: quatro serviços running/healthy, `/ready` 200 e ausência de bearer,
JWT, senha, chave, conteúdo, título, filename ou URL assinada nos logs.

## Gate automatizado fail-closed

O script exige Linux, `main` limpo, confirmação literal, `.env` com permissão
restrita, serviços healthy, schema remoto, métricas protegidas e logs
redigidos.

Gate completo não mutante:

```bash
cd /opt/nexus-ens
PHASE3_VPS_CONFIRM=RUN_PHASE_3_CONTROLLED_GATE \
PHASE3_RUN_NATIVE_GATES=true \
PHASE3_RUN_ISOLATED_DB_GATES=false \
PHASE3_RUN_MUTATING_E2E=false \
PHASE3_RUN_RESTART=false \
bash scripts/test/phase-3-vps.sh
```

`PHASE3_RUN_ISOLATED_DB_GATES` deve permanecer `false` na VPS de produção. O
reset desse gate é destinado apenas a uma instância Supabase local isolada.

## E2E controlado

Preencher no `.env` as variáveis `MARKETING_OPS_E2E_*` com três contas
exclusivas, campanha viewer, candidato, artifact e curso de teste. Não reutilizar
contas pessoais. O E2E usa o prefixo `[E2E-PHASE3]`, remove vínculos/artifact e
arquiva a campanha de teste, preservando auditoria.

```bash
cd /opt/nexus-ens
PHASE3_VPS_CONFIRM=RUN_PHASE_3_CONTROLLED_GATE \
PHASE3_RUN_NATIVE_GATES=false \
PHASE3_RUN_ISOLATED_DB_GATES=false \
PHASE3_RUN_MUTATING_E2E=true \
PHASE3_RUN_RESTART=false \
bash scripts/test/phase-3-vps.sh
```

## Restart e persistência

Criar primeiro uma fixture controlada contendo item agendado, dependência,
content version, artifact ativo e notificação. Registrar somente os UUIDs
técnicos. Então:

```bash
cd /opt/nexus-ens
PHASE3_VPS_CONFIRM=RUN_PHASE_3_CONTROLLED_GATE \
PHASE3_RUN_NATIVE_GATES=false \
PHASE3_RUN_ISOLATED_DB_GATES=false \
PHASE3_RUN_MUTATING_E2E=false \
PHASE3_RUN_RESTART=true \
PHASE3_RESTART_CONFIRM=RUN_PHASE_3_RESTART_GATE \
PHASE3_PERSISTENCE_ITEM_ID='<uuid-item>' \
PHASE3_PERSISTENCE_PREDECESSOR_ID='<uuid-predecessor>' \
PHASE3_PERSISTENCE_ASSET_ID='<uuid-content-asset>' \
PHASE3_PERSISTENCE_ARTIFACT_LINK_ID='<uuid-item-artifact>' \
PHASE3_PERSISTENCE_ARTIFACT_ID='<uuid-artifact-server>' \
bash scripts/test/phase-3-vps.sh
```

Depois do PASS, remover/desativar a fixture conforme a política de cleanup, sem
apagar auditoria legítima.

## Aceite

Executar o checklist de [vps-validation.md](vps-validation.md). Só depois dos
smokes manuais, logs, E2E, restart, cleanup e aceite do usuário a fase poderá
ser promovida a `production_validated`.
