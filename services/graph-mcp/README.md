# Nexus Graph MCP

MCP interno para memoria estruturada em Neo4j. Ele complementa o RAG: o RAG
responde com base em documentos; o Graph MCP responde sobre relacoes entre
negocio, marketing, TI, produtos, metricas, jornadas, riscos e integracoes.

## Deploy

O servico e montado pelo compose como `graph-mcp` e fica somente na rede Docker
interna. Hermes acessa:

```text
http://graph-mcp:8010/mcp
```

Nao exponha subdominio publico por padrao. Para checar na VPS:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps graph-mcp
curl -sf http://127.0.0.1:8010/health
```

## Variaveis importantes

```text
NEXUS_NEO4J_USER=neo4j
NEXUS_NEO4J_PASSWORD=<senha-forte-do-neo4j>
NEXUS_GRAPH_URL=bolt://neo4j:7687
NEXUS_GRAPH_MCP_URL=http://graph-mcp:8010/mcp
NEXUS_GRAPH_DATABASE=neo4j
NEXUS_GRAPH_DATABASE_STRATEGY=shared
NEXUS_GRAPH_BOOTSTRAP_ON_START=true
NEXUS_TENANT_ID=public
```

Para o primeiro cliente ENS, voce pode trocar `NEXUS_TENANT_ID=ens` quando
quiser separar o grafo inicial da area generica `public`. Para outros clientes,
use outro slug, por exemplo `acme`, `cliente-x` ou `grupo-demo`.

A unica credencial obrigatoria aqui e `NEXUS_NEO4J_PASSWORD`. Gere uma senha
forte antes do primeiro deploy de producao. O Graph MCP nao precisa de subdominio
ou chave publica propria nessa versao.

## Bootstrap white-label

No startup, quando `NEXUS_GRAPH_BOOTSTRAP_ON_START=true`, o servico cria:

- constraints e indices multi-tenant;
- um seed generico com dominios de Marketing, TI e Produtos;
- relacoes iniciais entre jornada, campanhas, CRM, catalogo, metricas e sistemas.

O seed fica em `src/graph/schema.ts`. Para adaptar para outro cliente, prefira
alimentar fatos via MCP (`nexus_graph_upsert_fact` e `nexus_graph_relate`) em vez
de hardcodar dados especificos no seed base.

## Ferramentas MCP

- `nexus_graph_guidance`: orienta quando usar grafo vs RAG.
- `nexus_graph_health`: valida conexao com Neo4j.
- `nexus_graph_bootstrap`: recria/garante indices e seed do tenant.
- `nexus_graph_search`: busca nos nos do tenant.
- `nexus_graph_neighbors`: carrega vizinhos de um no.
- `nexus_graph_query`: Cypher read-only com filtro obrigatorio por `tenant_id`.
- `nexus_graph_upsert_fact`: grava fatos duraveis.
- `nexus_graph_relate`: cria relacoes entre fatos.
