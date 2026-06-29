# Neo4j Multi-Tenant — White-Label SaaS Nexus (v3.7+)

**Versao:** v3.7+ (padrao de producao)
**Commit:** (ver git log)
**Status:** Implementado, testado, documentado

## Overview

Graphify skill do Hermes Agent agora roda num **Neo4j 5.x Community** com **multi-database** para suportar white-label SaaS multi-tenant. Cada tenant tem database exclusiva, garantindo isolamento total sem complexidade de Neo4j Enterprise.

### Por que Neo4j (e nao FalkorDB)?

| Aspecto             | Neo4j 5 Community         | FalkorDB             |
|---------------------|---------------------------|----------------------|
| License              | GPLv3 (community OK)     | MIT                  |
| Docker image         | neo4j:5-community       | falkordb/falkordb:latest |
| RAM                  | ~500MB                   | ~50MB                |
| Multi-database       | SIM (1 instancia)        | SIM (via SELECT)     |
| APOC procedures      | +500 graph algorithms    | -                    |
| Neo4j Browser        | Gratis (visualizacao)    | -                    |
| Cypher               | Padrao de mercado        | -                    |
| Cluster              | Enterprise ($)           | -                    |
| White-label SaaS     | OK (self-hosted, NAO embed) | OK                  |

**Decisao do projeto**: Neo4j 5 Community + multi-database. FalkorDB removido em v3.7+.

## Arquitetura

```
                        +---------------+
                        |  Hermes-Agent  |
                        |  (FastAPI)     |
                        |  X-Tenant-Id   |
                        +-------+-------+
                                |
                                v
+---------------------------+---------------------------+
|  graphify_backend.py      |  graphify_api.py          |
|  GraphBackend(            |  FastAPI router           |
|    tenant_id=acme        |  /api/graph/query,        |
|  ) -> USE DATABASE       |  /stats, /god-nodes,      |
|  nexus_tenant_acme       |  /explain                  |
+---------------------------+---------------------------+
                                |
                                v Bolt protocol (port 7687)
+---------------------------+---------------------------+
|  Neo4j 5.x Community      |  1+ N databases           |
|                          |  - neo4j (admin)          |
|                          |  - nexus_tenant_acme      |
|                          |  - nexus_tenant_globex     |
|                          |  - nexus_tenant_initech    |
|                          |                           |
|  Plugins: APOC            |  APOC: Leiden, BFS, etc. |
+---------------------------+---------------------------+
```

## Setup completo (3 cenarios)

### Cenario 1: SOLO/DEV (sem Neo4j)

**Quando**: desenvolvimento local, 1 usuario, graph.json manual.

```bash
# .env
NEXUS_GRAPH_BACKEND=local
# NEXUS_NEO4J_PASSWORD eh ignorado

# Neo4j container pode ficar offline
docker compose stop neo4j

# Procedimento
/graphify /opt/data/services   # mapa o codebase
ls /opt/data/graphify-out/    # graph.html, GRAPH_REPORT.md, graph.json
```

**Custo**: $0 RAM extra (graph.json local).

### Cenario 2: SINGLE-TENANT (1 empresa, 1 DB)

**Quando**: empresa instala Nexus Agent em servidor proprio. Sem multi-tenant ainda.

```bash
# .env
NEXUS_GRAPH_BACKEND=neo4j-self-hosted
NEXUS_NEO4J_PASSWORD=*** Cambio no docker compose
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d neo4j

# Validar (sem tenant = database 'neo4j' system)
docker compose exec hermes-api python /opt/graphify_backend.py --check
# Esperado: [health] {status: ok, backend: neo4j-self-hosted, database: neo4j}

# Popular Neo4j com graph.json existente
docker compose exec hermes-api python -c "
from graphify_backend import GraphBackend
b = GraphBackend(mode='neo4j-self-hosted', admin=True)
# Cypher IMPORT cypher.txt gerado por graphify --neo4j
"
```

**Custo**: ~500MB RAM Neo4j + 50MB/DB ativa.

### Cenario 3: MULTI-TENANT SAAS (white-label)

**Quando**: N clientes isolados, cada um com seu codebase.

```bash
# .env
NEXUS_GRAPH_BACKEND=neo4j-multi-tenant
NEXUS_NEO4J_PASSWORD=*** Cambio no docker compose
# (NEXUS_TENANT_ID eh setada per-request pelo cliente via header)

# Subir Neo4j
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d neo4j

# Provisionar tenants (uma vez por cliente novo)
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme-corp
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant globex-inc
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant initech-llc

# Listar
docker compose exec hermes-api python /opt/neo4j_admin.py list-tenants
# Saida:
#   - nexus_tenant_acme-corp (0.0.0.0:7687)
#   - nexus_tenant_globex-inc (0.0.0.0:7687)
#   - nexus_tenant_initech-llc (0.0.0.0:7687)

# Cada request HTTP carrega X-Tenant-Id:
curl -H "X-Tenant-Id: acme-corp" http://server/api/graph/stats
# {"tenant_id":"acme-corp","nodes":1234,"edges":5678,"labels":[...]}

curl -H "X-Tenant-Id: globex-inc" http://server/api/graph/stats
# {"tenant_id":"globex-inc","nodes":987,"edges":4321,"labels":[...]}

# Dados NAO vazam entre tenants (isolation no nivel de database Neo4j)
```

**Custo**: ~500MB RAM base + ~30MB/DB ativa. 100 tenants tipicamente 4GB RAM total.

## Endpoints HTTP (FastAPI)

Todos os endpoints requerem `X-Tenant-Id` header (exceto `/health`).

| Endpoint       | Method | Query params              | Body                          | Response                          |
|----------------|--------|---------------------------|-------------------------------|-----------------------------------|
| /health        | GET    | -                         | -                             | {status, backend, tenant_id}      |
| /query         | POST   | -                         | {cypher, params}              | {results, count}                  |
| /explain       | POST   | -                         | {label, depth}                | {results: nodes+edges}            |
| /stats         | GET    | -                         | -                             | {nodes, edges, labels}            |
| /god-nodes     | GET    | top_n=10                  | -                             | {god_nodes: [...]}                |

### Exemplo curl

```bash
# Stats
curl -H "X-Tenant-Id: acme" http://server/api/graph/stats

# Query Cypher
curl -X POST -H "X-Tenant-Id: acme" -H "Content-Type: application/json" \
     -d '{"cypher":"MATCH (n:Module) RETURN n LIMIT 5"}' \
     http://server/api/graph/query

# God nodes (top 10)
curl -H "X-Tenant-Id: acme" http://server/api/graph/god-nodes

# Sem X-Tenant-Id -> 400
curl http://server/api/graph/stats
# {"detail":"tenant_id required..."}
```

## Scripts CLI (neo4j_admin.py)

```bash
# Provisionar tenant
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme [--memory 512MB]

# Listar todos
docker compose exec hermes-api python /opt/neo4j_admin.py list-tenants

# Ver stats de um tenant
docker compose exec hermes-api python /opt/neo4j_admin.py stats acme

# Deletar (cuidado!)
docker compose exec hermes-api python /opt/neo4j_admin.py delete-tenant acme

# Help
docker compose exec hermes-api python /opt/neo4j_admin.py --help
```

Validacao automatica de tenant_id (regex `^[a-z0-9_-]{3,64}$`):
- aceito: `acme`, `globex-2024`, `tenant_abc`
- rejeitado: `BAD@ID`, `ab`, path traversal, mais de 64 chars

## Testes de isolamento

`tools/test_neo4j_multitenant.py` contem 5 testes de logica que nao precisam de Neo4j real:

```bash
docker compose exec hermes-api python /home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent/skills/code-graph/graphify/tools/test_neo4j_multitenant.py
```

Cobertura:
- test_tenant_db_name: tenant_id -> database name mapping
- test_tenant_id_validation: regex
- test_database_resolution: unicidade
- test_mode_validation: env detection
- test_tenant_environment_isolation: env var inheritance

## Performance esperada

| Cenario               | Latencia query    | Throughput         |
|-----------------------|-------------------|---------------------|
| Local (NetworkX)      | 50-200ms          | 1 user              |
| Neo4j self-hosted      | 10-50ms           | 10-50 users         |
| Neo4j multi-tenant     | 10-50ms/tenant    | 100+ users total    |
| Neo4j Cluster (Enterprise) | 5-20ms/tenant | 1000+ users        |

Graph sizes confortaveis:
- ate 50K nodes: rapido
- 50K-500K: degradado mas funcional
- 500K+: requer cluster Enterprise

## Backup / Disaster recovery

Neo4j Community suporta backup via:
```bash
# Backup completo
docker compose exec neo4j neo4j-admin database backup --database=neo4j \
  --backup-dir=/backups --to-path=neo4j_20260629.backup

# Restore
docker compose exec neo4j neo4j-admin database restore --from-path=/backups/neo4j_20260629.backup
```

Para tenant-specific backup (multi-tenant):
```bash
docker compose exec neo4j neo4j-admin database backup --database=nexus_tenant_acme \
  --backup-dir=/backups/tenants
```

Volume `./data/neo4j/` ja eh persistente via docker-compose.

## Quando migrar para Enterprise

SINAIS de que precisa upgrade:
- Mais de 100 tenants ativos
- Latencia >100ms em queries Cypher tipicas
- Clustering (multi-node Neo4j)
- Backup incremental (Enterprise feature)
- Monitoring 24/7 com suporte

Alternativas se quiser evitar $50k+/year Enterprise:
- Neo4j Aura (managed, $50+/mo)
- FalkorDB managed ($30-60/mo) - foi removido em v3.7+ mas pode voltar via fork
- Self-hosted FalkorDB (ja era opcao)

## Troubleshooting

### Neo4j nao conecta

```bash
docker compose logs neo4j | tail -30
docker compose exec neo4j cypher-shell -u neo4j -p $NEXUS_NEO4J_PASSWORD "RETURN 1"
```

### Tenant database nao existe

```bash
docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant <id>
# Reinicie hermes-api pra re-ler NEXUS_TENANT_ID se mudou
docker compose restart hermes-api
```

### Multi-tenant vazando dados

NAO eh possivel com Neo4j multi-database. Cada backend usa:
```cypher
USE DATABASE nexus_tenant_<id>
```

antes de qualquer query. Dados NAO compartilham entre tenants.

### Memory pressure

Neo4j Community usa memoria configurada via env vars no compose:
- `NEO4J_server_memory_heap_initial__size=512m`
- `NEO4J_server_memory_heap_max__size=1G`

Para mais, aumentar no docker-compose + redeploy.

## Arquivos relacionados

```
services/hermes-runtime/vendor/hermes-agent/skills/code-graph/graphify/
├── SKILL.md                                            (712 linhas, v3.7+ Neo4j only)
└── tools/
    ├── graphify_backend.py                             (250+ linhas, 3 modos Neo4j)
    ├── graphify_api.py                                  (FastAPI router)
    ├── graphify_api_server.py                           (standalone runner)
    ├── neo4j_admin.py                                   (CLI: create/list/delete/stats)
    └── test_neo4j_multitenant.py                        (5 testes de logica)

services/hermes-runtime/docker/
└── hermes.Dockerfile                                   (ENV neo4j-multi-tenant default)

docker-compose.yml                                       (Neo4j descomentado + envs)
```

## Referencias externas

- Neo4j 5 docs: https://neo4j.com/docs/
- Multi-database in Neo4j: https://neo4j.com/docs/operations-manual/current/clustering/databases/
- neo4j Python driver: https://neo4j.com/docs/python-manual/current/
- Cypher reference: https://neo4j.com/docs/cypher-manual/current/

## Roadmap

- v3.7+ (atual): Neo4j Community + multi-database
- v3.8 (futuro): Neo4j vector embeddings + GraphRAG (substituir Pgvector como store)
- v3.9 (futuro): Streamable HTTP MCP server com auth JWT multi-tenant
- v4.0 (quando necessario): Enterprise / FalkorDB managed migration path
