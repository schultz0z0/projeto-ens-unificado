# Deploy Guide: Hermes Memory Routing Final Package

## Scope

This deploy includes:

- Nexus memory-routing contract in the chat bridge.
- Tenant/user headers from frontend to bridge to Hermes.
- Graph MCP `LIMIT` fix for Neo4j.
- Graph write safety: read/search/query remain available; writes require explicit validation.
- Runtime rollback flag for the routing contract.
- RAG MCP internal graph-sync source endpoint.
- Graph MCP admin sync tool for lightweight RAG references.
- Bridge memory diagnostics for Hermes/RAG/Graph tool usage.
- Trusted tenant routing with ENS as the first white-label tenant.

Hermes native persistent memory remains active and unchanged.

## Required Environment

Set this in the VPS `.env`:

```bash
NEXUS_MEMORY_ROUTING_CONTRACT_ENABLED=true
NEXUS_TENANT_ID=ens
NEXUS_RAG_INTERNAL_URL=http://rag-mcp:8000/internal/graph-sync/sources
```

Rollback switch:

```bash
NEXUS_MEMORY_ROUTING_CONTRACT_ENABLED=false
```

Changing this flag requires restarting `app-bridge`.

Recommended hardening:

```bash
NEXUS_INTERNAL_SYNC_KEY=<strong-random-internal-key>
```

Use the same value for `rag-mcp`, `graph-mcp`, and `app-bridge` through Compose.

## Build On VPS

From the project directory:

```bash
git pull

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  config --quiet

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  build rag-mcp graph-mcp app-bridge app-frontend
```

## Deploy On VPS

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d rag-mcp graph-mcp app-bridge app-frontend
```

Recommended status check:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  ps graph-mcp app-bridge app-frontend hermes-api neo4j rag-mcp
```

Recommended logs:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  logs -f --tail=120 rag-mcp graph-mcp app-bridge app-frontend
```

## Health Checks

Graph MCP:

```bash
curl -fsS http://127.0.0.1:${NEXUS_GRAPH_MCP_PORT:-8010}/health
```

Chat bridge:

```bash
curl -fsS http://127.0.0.1:${NEXUS_CHAT_BRIDGE_PORT:-8081}/health
```

RAG graph-sync source endpoint, without printing secrets:

```bash
curl -fsS \
  -H "X-Nexus-Internal-Key: ${NEXUS_INTERNAL_SYNC_KEY}" \
  "http://127.0.0.1:${NEXUS_RAG_MCP_PORT:-8000}/internal/graph-sync/sources?tenant=ens&collections=courses&limit=1"
```

If `NEXUS_INTERNAL_SYNC_KEY` is intentionally blank, omit the header.

## Bootstrap

Manual bootstrap is not required for a normal deploy when:

- Neo4j is already running.
- `NEXUS_GRAPH_BOOTSTRAP_ON_START=true`.
- The existing ENS tenant graph already has the generic seed.

Run or trigger bootstrap only when:

- The Neo4j data volume is new.
- A new tenant/database was provisioned.
- `nexus_graph_health` works but the tenant has no seed nodes.

For a manual operational check after deploy, ask Nexus in the app:

```text
Teste de auditoria: use nexus_graph_health e depois nexus_graph_search por Marketing com limit 10. Resuma tenant, database, estrategia e resultados. Nao invente caso a ferramenta falhe.
```

Expected:

- `nexus_graph_health` reports tenant `ens`.
- `nexus_graph_search` no longer fails with `LIMIT 10.0`.

## RAG To Graph Sync

First run a dry-run from Nexus/Hermes:

```text
Use nexus_graph_sync_rag_refs em dry_run=true para tenant ens, collections courses, marketing, insights e institutional, limit 50, admin_mode=true, validated=true, validation_note="Pre-deploy dry-run aprovado pelo operador". Resuma somente contagens e exemplos de ids; nao copie conteudo longo do RAG.
```

Then run the real sync only after the dry-run looks right:

```text
Execute nexus_graph_sync_rag_refs para tenant ens, collections courses, marketing, insights e institutional, limit 100, admin_mode=true, validated=true, validation_note="Operador aprovou sincronizar referencias leves RAG para Graph apos dry-run". Depois rode nexus_graph_search por "Curso" e por "Marketing".
```

Expected:

- Graph nodes use `course_ref`, `marketing_ref`, `insight_ref`, or `institutional_ref`.
- Node properties include source pointers such as `source_collection`, `source_document_id`, `source_uri`, and `last_verified_at`.
- No long course descriptions, ementas, modules, or RAG document bodies are copied into Graph.

## Smoke Test Prompts

Hermes memory continuity:

```text
Lembre que para esta sessao minha palavra de teste e azul-cobalto. Depois me perguntei qual era.
```

RAG-first course question:

```text
Use o RAG da ENS para me dizer detalhes oficiais de um curso voltado para corretores iniciantes.
```

Graph-first relationship question:

```text
Use o Graph para mapear relacoes entre Marketing, CRM, cursos ENS e jornada do aluno. Se nao houver relacoes, diga exatamente o que encontrou.
```

Hybrid question:

```text
Monte uma campanha para um curso ENS: use RAG para os fatos oficiais do curso e Graph para relacoes de persona, canal, CRM e KPI quando existirem.
```

Diagnostics:

```text
Apos responder, verifique se houve uso de RAG/Graph e resuma quais camadas foram observadas. Se Graph falhar, diga a falha e nao invente relacoes.
```

## Rollback

Fast rollback of the routing prompt:

```bash
NEXUS_MEMORY_ROUTING_CONTRACT_ENABLED=false

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d app-bridge
```

Code rollback:

```bash
git log --oneline -5
git revert <commit_sha>

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  build rag-mcp graph-mcp app-bridge app-frontend

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d rag-mcp graph-mcp app-bridge app-frontend
```
