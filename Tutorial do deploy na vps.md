# Tutorial de deploy na VPS

Este projeto roda tudo pelo monorepo `/opt/projeto-ens`:

- frontend/app
- app-bridge
- Hermes API e Kanban usando o fork local em `services/hermes-runtime/vendor/hermes-agent`
- RAG MCP ENS
- designer-api/gerador de imagem

Use sempre os dois arquivos Compose em producao:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ...
```

## Regra importante: bootstrap antes do Compose

Em deploy limpo, rode obrigatoriamente:

```bash
bash scripts/bootstrap.sh
```

Esse script cria as pastas `data/` e, se ainda nao existir, copia:

```bash
infra/hermes/config.yaml -> data/hermes/config.yaml
```

Esse arquivo instala o RAG MCP ENS no Hermes com:

```yaml
mcp_servers:
  nexus_rag:
    url: "http://rag-mcp:8000/mcp"
    timeout: 180
    connect_timeout: 30
    sampling:
      enabled: false
```

Se `data/hermes/config.yaml` ja existir, o bootstrap nao sobrescreve. Alem disso, o Hermes pode usar perfis em `data/hermes/profiles/<perfil>/config.yaml`; por isso a imagem do Hermes tambem garante automaticamente o mesmo MCP no config raiz e nos configs dos perfis existentes toda vez que `hermes-api` ou `hermes-kanban` iniciam.

## Deploy do zero em VPS nova

Use este fluxo quando apagou tudo e quer subir do zero.

```bash
sudo mkdir -p /opt/projeto-ens
sudo chown -R "$USER:$USER" /opt/projeto-ens
cd /opt/projeto-ens
git clone https://github.com/schultz0z0/projeto-ens-unificado.git .
```

Crie/cole o `.env` completo:

```bash
nano .env
```

Rode o bootstrap:

```bash
bash scripts/bootstrap.sh
```

Confira se o Hermes recebeu o RAG MCP ENS:

```bash
cat data/hermes/config.yaml
```

Precisa aparecer o bloco:

```yaml
mcp_servers:
  nexus_rag:
    url: "http://rag-mcp:8000/mcp"
```

Valide o Compose antes de buildar:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/projeto-ens-compose.yml
```

Build limpo:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
```

Suba tudo:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --remove-orphans
```

Confira os containers:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Atualizando projeto ja rodando

Use este fluxo quando o projeto ja existe em `/opt/projeto-ens` e voce quer atualizar o Docker atual sem apagar `data/`.

Entre na pasta:

```bash
cd /opt/projeto-ens
```

Atualize os arquivos do repositorio:

```bash
git pull
```

Confira/ajuste o `.env` se houver variavel nova:

```bash
nano .env
```

Rode o bootstrap novamente. Ele cria pastas faltantes, mas preserva arquivos existentes:

```bash
bash scripts/bootstrap.sh
```

Confira o MCP raiz do Hermes:

```bash
cat data/hermes/config.yaml
```

Se voce estiver usando perfil no Hermes, confira tambem os configs dos perfis:

```bash
find data/hermes/profiles -maxdepth 2 -name config.yaml -print -exec grep -n "nexus_rag" {} \; 2>/dev/null || true
```

Depois desta atualizacao, o container corrige isso automaticamente no start. O bloco esperado no config raiz e no perfil ativo e:

```yaml
mcp_servers:
  nexus_rag:
    url: "http://rag-mcp:8000/mcp"
    timeout: 180
    connect_timeout: 30
    sampling:
      enabled: false
```

Valide o Compose:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/projeto-ens-compose.yml
```

Rebuild completo e recriacao dos containers:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --remove-orphans
```

Se a mudanca foi especificamente no Hermes/MCP, voce pode rebuildar apenas estes servicos:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api hermes-kanban
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api hermes-kanban app-bridge
```

Confira:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Atualizacao rapida sem rebuild completo

Use somente quando mudou `.env`, `data/hermes/config.yaml` ou configuracao, sem alterar Dockerfile/dependencias/codigo buildado.

```bash
cd /opt/projeto-ens
bash scripts/bootstrap.sh
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/projeto-ens-compose.yml
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --remove-orphans
```

Se a mudanca for apenas no `data/hermes/config.yaml`, normalmente basta reiniciar Hermes e bridge:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml restart hermes-api app-bridge
```

## Supabase do RAG MCP

As migrations do RAG MCP sao aplicadas manualmente no Supabase do RAG, pelo SQL Editor. Para um projeto ja existente, use esta ordem:

```text
services/rag-mcp/supabase/migrations/2026-06-10-rag-ingestion.sql
services/rag-mcp/supabase/migrations/2026-06-16-ens-rag-collections.sql
services/rag-mcp/supabase/migrations/2026-06-16-remove-nexusai-tenant.sql
services/rag-mcp/supabase/migrations/2026-06-17-ens-course-advanced-search.sql
```

Depois da migration `2026-06-17`, reingira os cursos. Ela muda a estrategia de cursos para criar um chunk `course_offer` por oferta, com filtros de status, modalidade, localidade e datas:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d rag-mcp
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -e MCP_URL=http://127.0.0.1:8000/mcp rag-mcp node scripts/run-first-ingestion.mjs
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -e MCP_URL=http://127.0.0.1:8000/mcp rag-mcp node scripts/validate-ens-rag.mjs
```

O Compose tambem sobe `rag-mcp-ingestion-cron`. Ele roda automaticamente toda segunda-feira as 07h no fuso `NEXUS_TZ`:

```env
NEXUS_TZ=America/Sao_Paulo
NEXUS_RAG_INGEST_ACTOR_PROFILE=ceo
NEXUS_RAG_INGEST_CRON_SCHEDULE=0 7 * * 1
```

Esse cron executa a ingestao completa uma vez por semana:

```text
1. cursos pela API do site da ENS
2. institutional pelos arquivos services/rag-mcp/data/institutional
3. marketing pelos arquivos services/rag-mcp/data/marketing
4. insights pelos arquivos services/rag-mcp/data/insights
5. validacao geral do RAG
```

Se voce alterar arquivos locais em `services/rag-mcp/data`, faca rebuild do `rag-mcp`; esses arquivos entram na imagem Docker.

## Verificacoes pos-deploy

Status geral:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

Logs principais:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 rag-mcp hermes-api app-bridge app-frontend designer-api hermes-kanban
```

Health checks internos:

```bash
curl -sf http://127.0.0.1:8000/health
curl -sf http://127.0.0.1:8652/health
curl -sf http://127.0.0.1:8081/health
curl -sf http://127.0.0.1:8090/health
```

Teste funcional da persistencia do chat:

1. Abra `https://app.solucoes-nexus.tech`.
2. Crie um chat novo.
3. Envie: `Minha cor escolhida e vermelho`.
4. Depois envie no mesmo chat: `qual e a minha cor escolhida?`.
5. O Hermes deve responder que a cor escolhida e vermelho.

Teste do RAG MCP ENS:

1. Pergunte ao Hermes algo que dependa dos cursos/ENS.
2. Se ele nao consultar o RAG, confira:

```bash
cat data/hermes/config.yaml
find data/hermes/profiles -maxdepth 2 -name config.yaml -print -exec grep -n "nexus_rag" {} \; 2>/dev/null || true
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 rag-mcp hermes-api
```

## Observacoes importantes

- Nao use `down -v`, porque isso pode remover volumes Docker nomeados. Neste projeto os dados principais estao em bind mount `./data`, mas ainda assim evite `-v`.
- Nao apague `data/hermes` se quiser preservar sessoes/configuracoes do Hermes.
- O Compose usa o fork local do Hermes em `services/hermes-runtime/vendor/hermes-agent`; isso e instalado na imagem pelo `services/hermes-runtime/docker/hermes.Dockerfile`.
- O RAG MCP fica interno, acessivel pelo Hermes em `http://rag-mcp:8000/mcp`.
- O dashboard MCP do Hermes e escopado por perfil. Se a tela mostrar `Your MCP servers (0)`, confira o perfil ativo e reinicie `hermes-api`/`hermes-kanban`; a imagem atual garante `nexus_rag` no config raiz e nos perfis existentes sem apagar memoria, sessoes ou skills.
