# Graphify Backend — 3 Cenarios White-Label Nexus

**Versao:** v3.6+ (atual)
**Status:** ✅ Implementado no fork
**Commit:** `2d4dc4c` (skill base) + commits subsequentes (backend wrapper)

## Overview

Graphify skill agora suporta 3 backends via env var `NEXUS_GRAPH_BACKEND`:

| Backend   | License  | RAM   | Custo     | Quando usar                  |
|-----------|----------|-------|-----------|------------------------------|
| `local`   | BSD 3    | ~50MB | $0        | SOLO/DEV/1-user              |
| `falkordb`| **MIT**  | ~50MB | $0        | Multi-tenant self-hosted     |
| `neo4j`   | GPLv3    | ~500MB| $0*       | Heavy analytics enterprise   |

*Neo4j Community = GPLv3. Distribuir como SaaS branco exige Enterprise (caro).

**Default:** `local` — zero mudanca no comportamento atual.

---

## Cenario 1: SOLO/DEV (default, sem mudanca)

**Status:** ✅ Ja funciona (commit `2d4dc4c`)

### Setup

```bash
# 1. Build do Hermes (graphify ja vem embutido)
cd /opt/projeto-ens
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build hermes-api

# 2. Recreate
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api

# 3. Confirmar
docker compose exec hermes-api /opt/hermes/.venv/bin/graphify --version
# Esperado: graphify 0.9.2
```

### Uso

```bash
# Dentro do Hermes (chat)
/graphify /opt/data/services   # mapa atual
/graphify /opt/data/services --update   # incremental

# Resultado sai em graphify-out/ (graph.html, GRAPH_REPORT.md, graph.json)
```

### Custos

- Docker disk: +~50MB (deps Python)
- RAM: +50MB durante extracao (NetworkX)
- Nada persistente (graph.json fica em /opt/data)

---

## Cenario 2: WHITE-LABEL SELF-HOSTED (1 empresa, multi-user local)

**Status:** ⚙️ Requer ativar servicos FalkorDB/Neo4j opcionalmente

### Quando usar

- Empresa cliente instala Nexus Agent em servidor proprio
- Multiplos users internos consultam o mesmo codebase
- Dados nao podem sair do servidor (compliance)
- Multi-tenant ainda nao necessario

### Setup: FalkorDB (recomendado, MIT)

```bash
# 1. No .env (raiz do projeto), adicione:
NEXUS_GRAPH_BACKEND=falkordb
NEXUS_FALKORDB_PASSWORD=sua-senha-forte
# Opcional (defaults ja funcionam):
# NEXUS_GRAPH_URL=redis://falkordb:6379
# NEXUS_GRAPH_DB=nexus

# 2. Em docker-compose.yml, descomentar bloco falkordb
# (linhas 352-383 comeca com "  # ============================================================================")
# Remover o '#' de image, container_name, environment, volumes, ports, etc.

# 3. No hermes-api service, adicionar NEXUS_GRAPH_BACKEND na env:
#    environment:
#      - NEXUS_GRAPH_BACKEND=${NEXUS_GRAPH_BACKEND:-local}
#      - NEXUS_GRAPH_URL=${NEXUS_GRAPH_URL:-redis://falkordb:6379}

# 4. Build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build falkordb hermes-api

# 5. Subir
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d falkordb

# 6. Validar
docker compose exec hermes-api python /opt/graphify_backend.py --check
# Esperado: [health] {'status': 'ok', 'backend': 'falkordb', 'db': 'nexus'}
```

### Setup: Neo4j (alternativa, GPLv3)

```bash
# 1. No .env:
NEXUS_GRAPH_BACKEND=neo4j
NEXUS_NEO4J_PASSWORD=sua-senha-neo4j

# 2. Descomentar bloco neo4j no docker-compose.yml
# 3. Adicionar NEXUS_GRAPH_BACKEND/URL na env do hermes-api
# 4. Build + up
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build neo4j hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d neo4j
docker compose exec hermes-api python /opt/graphify_backend.py --check
# Esperado: [health] {'status': 'ok', 'backend': 'neo4j', 'db': 'nexus'}
```

### Custos

- Docker disk: +~100MB (FalkorDB ~50MB + Neo4j ~150MB se ativo)
- RAM: +50MB (FalkorDB) ou +500MB (Neo4j)
- Persistente: dados em `./data/falkordb/` ou `./data/neo4j/`

---

## Cenario 3: WHITE-LABEL MULTI-TENANT SAAS

**Status:** 🔒 Requer Fase 3 (Streamable HTTP wrapper + tenant isolation)

### Quando usar

- >3 tenants simultaneos
- Cada tenant tem codebase proprio
- Querem acesso via API REST/WebSocket (nao so CLI)
- Precisa de UI web pra explorar graph (frontend custom)

### Setup (roadmap)

1. Subir FalkorDB centralizado (cenario 2)
2. Criar 1 database FalkorDB por tenant:
   - `nexus:tenant_empresa_a`
   - `nexus:tenant_empresa_b`
3. Wrapper HTTP pra graphify serve.py (Streamable MCP transport, ja existe no upstream)
4. Auth layer: cada request JWT do tenant seleciona database
5. UI frontend Next.js consumindo `/api/graph/query?tenant=X`

**Esforco total:** 3-5 dias (Fase 3)
**Quando comecar:** Quando primeiro cliente real precisar

### Custos estimados

- VPS dedicada FalkorDB: $5-20/mo (1GB-4GB RAM)
- Multi-tenant logic: complexidade adicional
- Licenca: $0 (FalkorDB MIT)

---

## Decisao automatica no build (ja implementada)

O Dockerfile ja prepara TUDO pro cliente:

```dockerfile
# ENV default (linha do HERMES_SOURCE_DIR)
ENV NEXUS_GRAPH_BACKEND=local \
    NEXUS_GRAPH_URL=redis://falkordb:6379 \
    NEXUS_GRAPH_DB=nexus \
    NEXUS_GRAPH_JSON=/opt/data/graphify-out/graph.json

# COPY do wrapper Python pro container
COPY vendor/hermes-agent/skills/code-graph/graphify/tools/graphify_backend.py /opt/graphify_backend.py
RUN /opt/hermes/.venv/bin/python /opt/graphify_backend.py --check 2>&1 | tail -2
```

**Zero config manual pos-deploy.** Cliente soh precisa:
1. Setar `NEXUS_GRAPH_BACKEND` no `.env`
2. (Opcional) descomentar bloco `falkordb:` no docker-compose.yml
3. Rebuild + up

---

## Troubleshooting

### Erro "falkordb nao instalado"

```bash
# Verificar se esta instalado no venv
docker compose exec hermes-api /opt/hermes/.venv/bin/pip show falkordb
# Se nao:
docker compose exec hermes-api /opt/hermes/.venv/bin/pip install "graphifyy[all]"
```

### Erro "NEXUS_GRAPH_BACKEND=neo4j mas falkordb subiu"

```bash
# Backend selector caiu no default. Verificar env:
docker compose exec hermes-api env | grep NEXUS_GRAPH
# Deve mostrar: NEXUS_GRAPH_BACKEND=neo4j
```

### FalkorDB nao conecta (timeout)

```bash
# 1. Health check do FalkorDB
docker compose exec falkordb redis-cli -a $NEXUS_FALKORDB_PASSWORD ping
# Esperado: PONG

# 2. Network entre containers
docker compose exec hermes-api ping -c 2 falkordb
# Esperado: 0% packet loss

# 3. Health do wrapper
docker compose exec hermes-api /opt/hermes/.venv/bin/python /opt/graphify_backend.py --check
```

### Graph.json corrompido (modo local)

```bash
# Reconstruir do codebase
docker compose exec hermes-api /opt/hermes/.venv/bin/graphify . --force
```

---

## Roadmap

- [x] **v3.5**: Skill graphify standalone (commit `2d4dc4c`)
- [x] **v3.6**: Backend selector local/falkordb/neo4j (este doc)
- [ ] **v3.7**: Streamable HTTP wrapper (necessario pra multi-tenant)
- [ ] **v3.8**: UI web pra explorar graph
- [ ] **v3.9**: Vector embeddings (GraphRAG real)

---

## Referencias

- **Graphify upstream**: https://github.com/safishamsi/graphify
- **FalkorDB**: https://github.com/FalkorDB/FalkorDB
- **Neo4j community**: https://neo4j.com/download-center/#community
- **MCP protocol**: https://modelcontextprotocol.io
