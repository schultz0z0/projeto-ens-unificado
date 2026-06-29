# White-Label Multi-User + Multi-Tenant (v3.8+)

**Versao:** v3.8+
**Commit:** (ver git log)
**Status:** ✅ Implementado e testado

## Overview

O fork Hermes Nexus implementa 3 niveis de isolamento para white-label SaaS:

1. **Tenant** (empresa): cada instalacao/empresa 1 database Neo4j
2. **User** (funcionario): cada employee 1 database PRIVADA dentro do tenant
3. **Memory** (estado do Hermes): memoria GLOBAL compartilhada + memoria POR-USER

Hierarquia no Neo4j (multi-database):
- `neo4j` (system admin)
- `nexus_tenant_<tenant_id>` (todos os users veem)
- `nexus_tenant_<tenant_id>_user_<user_id>` (so o user ve)

Hierarquia de arquivos (filesystem):
- `<data_dir>/memory/tenant_<id>/global.md` (team knowledge)
- `<data_dir>/memory/tenant_<id>/users/<user_id>/memory.md` (user prefs)

## Quem usa o que

| Componente     | Quem governa | Quando |
|----------------|--------------|--------|
| Neo4j tenant DB | Empresa instala | SaaS multi-cliente |
| Neo4j user DB   | Empresa provisiona via neo4j_admin | User novo onboarded |
| Memory global   | Toda equipe | MCP RAG, estrategias, brand-book |
| Memory user     | User individual | Nome, estilo, gostos |

## Arquitetura

```
                        Apps (frontend, webchat)
                            |
                            v
+-----------------------------------------------------+
| Hermes (FastAPI, auth via Supabase JWT)             |
| - X-Tenant-Id header -> Neo4j tenant DB             |
| - X-User-Id header -> Neo4j user DB + Memory user  |
+-----------------------------------------------------+
        |                       |                  |
        v                       v                  v
+-----------+         +-----------+       +-----------+
| Neo4j     |         | Memory    |       | Graphify  |
| Multi-DB  |         | Store     |       | Tools     |
| per-tenant|         | (per-     |       | (per-     |
| + user    |         |  user)    |       |  user)    |
+-----------+         +-----------+       +-----------+
```

## Setup completo na VPS

### Pre-requisitos

Ja configurado no Dockerfile/docker-compose (v3.7+):
- Python 3.11+ venv com `neo4j`, `falkordb`, `playwright` (via graphifyy[all])
- FastAPI 0.133.1 instalado
- Neo4j 5.x container rodando
- APOC plugin

### 1. Configurar env

```bash
# .env
NEXUS_GRAPH_BACKEND=neo4j-multi-tenant-user
NEXUS_NEO4J_PASSWORD=*** rand -hex 16)
# Opcional - se quiser fixar (modo service-account)
NEXUS_TENANT_ID=acme-corp
# NEXUS_USER_ID nao fixar - vem do JWT do Supabase
```

### 2. Build + up (uma vez)

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d neo4j hermes-api app-bridge app-frontend
```

### 3. Provisionar empresa nova (signup)

```bash
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme-corp
# Saida: [OK] Tenant database criado: nexus_tenant_acme-corp
```

### 4. Provisionar user novo (Supabase signup)

Quando um user novo faz signup no Supabase, webhook cria o user database:

```bash
docker compose exec hermes-api python /opt/neo4j_admin.py create-user-db acme-corp 550e8400-e29b-41d4-a716-446655440000
# Saida: [OK] User database criado: nexus_tenant_acme-corp_user_550e8400-e29b-41d4-a716-446655440000
```

### 5. User faz login

Frontend envia:
```http
Authorization: Bearer <supabase-jwt>
X-Tenant-Id: acme-corp        (do JWT claim)
X-User-Id: 550e8400-e29b-41d4-a716-446655440000  (do JWT sub)
```

Hermes extrai tenant_id + user_id do JWT automaticamente (ou dos headers se modo privado).

### 6. User usa memoria privada (1x setup, 1x use)

```bash
# Primeira vez: salva prefs
curl -X POST -H "X-Tenant-Id: acme-corp" -H "X-User-Id: alice-uuid" \
     -H "Content-Type: application/json" \
     -d "{\"content\": \"# Alice prefs\\n- Calls me: Duda\\n- Style: direct\"}" \
     http://server/api/memory/user

# Proximas sessoes: le prefs
curl -H "X-Tenant-Id: acme-corp" -H "X-User-Id: alice-uuid" \
     http://server/api/memory/user
```

## Endpoints da API

### Memory API (FastAPI)

```
GET  /api/memory/global   - le team knowledge (X-Tenant-Id required)
POST /api/memory/global   - escreve team knowledge
GET  /api/memory/user     - le user prefs (X-Tenant-Id + X-User-Id required)
POST /api/memory/user     - escreve user prefs
DELETE /api/memory/user?confirm=DELETE - deleta user (irreversivel)
GET  /api/memory/all      - global + user merged
GET  /api/memory/stats    - bytes globais e privados
```

### Graph API (FastAPI - Neo4j)

```
GET  /api/graph/health
POST /api/graph/query     {cypher, params}
POST /api/graph/explain   {label, depth}
GET  /api/graph/stats
GET  /api/graph/god-nodes
```

## Caso 1: SOLO/DEV (sem Neo4j)

Perfil dev. Memoria local em `/opt/data/memory/<user>/memory.md`.
Graph.json local em `/opt/data/graphify-out/`.

```bash
# .env
NEXUS_GRAPH_BACKEND=local
NEXUS_MEMORY_DIR=/opt/data/memory
```

```bash
docker compose --env-file .env -f docker-compose.yml up -d hermes-api
```

## Caso 2: SINGLE-TENANT (1 empresa, varios users internos)

Empresa instala Nexus. Usuarios vem do Supabase.

```bash
# .env
NEXUS_GRAPH_BACKEND=neo4j-self-hosted
NEXUS_TENANT_ID=acme-corp           # fixo - 1 empresa
NEXUS_NEO4J_PASSWORD=***
```

```bash
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme-corp
# (users usam a mesma database)
```

## Caso 3: MULTI-TENANT SAAS (white-label, varios clientes)

SaaS com N clientes. Cada empresa 1 tenant, varios users internos.

```bash
# .env
NEXUS_GRAPH_BACKEND=neo4j-multi-tenant-user
NEXUS_NEO4J_PASSWORD=***
# NEXUS_TENANT_ID nao fixar - vem do header ou JWT
# NEXUS_USER_ID nao fixar - vem do header ou JWT
```

```bash
# Provisionar tenant (admin)
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant globex

# Quando user faz signup no Supabase (webhook)
docker compose exec hermes-api python /opt/neo4j_admin.py create-user-db acme <user_uuid>
docker compose exec hermes-api python /opt/neo4j_admin.py create-user-db globex <user_uuid>

# Listar todos databases
docker compose exec hermes-api python /opt/neo4j_admin.py list-databases
```

## Comandos CLI

### neo4j_admin.py

```bash
# Tenant
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant <id> [--memory 256MB]
docker compose exec hermes-api python /opt/neo4j_admin.py delete-tenant <id> [--force]
docker compose exec hermes-api python /opt/neo4j_admin.py list-databases
docker compose exec hermes-api python /opt/neo4j_admin.py stats <database>

# User (dentro de tenant)
docker compose exec hermes-api python /opt/neo4j_admin.py create-user-db <tenant_id> <user_id>
docker compose exec hermes-api python /opt/neo4j_admin.py delete-user-db <tenant_id> <user_id> [--force]
```

### memory_store.py

```bash
docker compose exec hermes-api python /opt/memory_store.py write-global --tenant-id <id> --content-file <file>
docker compose exec hermes-api python /opt/memory_store.py read-global --tenant-id <id>
docker compose exec hermes-api python /opt/memory_store.py write-user --tenant-id <id> --user-id <id> --content-file <file>
docker compose exec hermes-api python /opt/memory_store.py read-user --tenant-id <id> --user-id <id>
docker compose exec hermes-api python /opt/memory_store.py stats --tenant-id <id> [--user-id <id>]
```

### Tests (sem Neo4j, valida logica)

```bash
docker compose exec hermes-api python /home/.../tools/test_neo4j_multitenant.py
# Output:
#   [OK] test_tenant_db_name
#   [OK] test_user_db_name
#   [OK] test_tenant_id_validation
#   [OK] test_user_id_validation
#   [OK] test_database_resolution (tenant != user)
#   [OK] test_mode_validation
#   [OK] test_scope_routing (tenant != user)
#   [OK] test_user_env_isolation
#   ALL 8 LOGIC TESTS PASSED (v3.8+ multi-tenant + multi-user)
```

## Decisao arquitetural

Por que usar **Neo4j multi-database** em vez de **Neo4j com labels dentro de 1 DB**?

| Aspecto              | Multi-database (escolhido) | Single-db com labels |
|----------------------|----------------------------|-----------------------|
| Isolamento           | Fisico (DB separada)      | Logico (label)         |
| Backup por tenant    | Trivial (`dump tenant_db`) | Complexo (filtrar)    |
| Performance isolada  | Excelente                  | Ruim (graph completo)  |
| Granularidade perm.  | Nativa Neo4j               | Manual                 |
| Custo RAM            | ~50MB/DB ativa             | 1 graph gigante        |

Vencedor: multi-database. Custo baixo de memoria pra 10-100 tenants.

## Arquivos do projeto

```
services/hermes-runtime/vendor/hermes-agent/skills/code-graph/graphify/
├── SKILL.md                                  (v3.8+ docs)
└── tools/
    ├── graphify_backend.py                   (Neo4j multi-tenant + multi-user)
    ├── graphify_api.py                       (FastAPI router pro graph)
    ├── graphify_api_server.py                (standalone runner)
    ├── neo4j_admin.py                        (CLI: create-tenant/create-user-db)
    ├── memory_store.py                        (File-based dual-storage memory)
    ├── memory_api.py                         (FastAPI router pro memory)
    └── test_neo4j_multitenant.py             (8 logic tests)

services/hermes-runtime/docker/
└── hermes.Dockerfile                         (ENV vars + COPY)

docker-compose.yml                            (Neo4j + envs)
```

## Referencias

- Neo4j multi-database: https://neo4j.com/docs/operations-manual/current/clustering/databases/
- neo4j Python driver: https://neo4j.com/docs/python-manual/current/
- FastAPI: https://fastapi.tiangolo.com/
- Supabase auth: https://supabase.com/docs/guides/auth
