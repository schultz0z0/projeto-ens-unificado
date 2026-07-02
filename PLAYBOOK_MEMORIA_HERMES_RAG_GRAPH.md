# Playbook: Memoria Hermes + RAG + Graph por empresa

Este playbook deve ser usado sempre que formos ativar ou atualizar a memoria
Hermes + MCP RAG + MCP Graph para uma empresa/tenant white-label.

Objetivo realista:

- Manter a memoria nativa persistente do Hermes funcionando como base.
- Usar o RAG como fonte oficial de conteudo: catalogo, documentos, marketing,
  institucional, analises e materiais indexados.
- Usar o Graph como memoria relacional leve: mapas, relacoes, jornadas,
  dependencias, referencias e ponteiros para o RAG.
- Nao copiar conteudo longo do RAG para o Graph.

## 1. Variaveis obrigatorias na VPS

No `.env` da VPS, ajuste para o tenant da empresa:

```bash
NEXUS_MEMORY_ROUTING_CONTRACT_ENABLED=true
NEXUS_TENANT_ID=<tenant_id>
NEXUS_GRAPH_MCP_URL=http://graph-mcp:8010/mcp
NEXUS_RAG_INTERNAL_URL=http://rag-mcp:8000/internal/graph-sync/sources
NEXUS_INTERNAL_SYNC_KEY=<chave-interna-forte>
```

Para ENS:

```bash
NEXUS_TENANT_ID=ens
```

Gerar `NEXUS_INTERNAL_SYNC_KEY`:

```bash
openssl rand -hex 32
```

Use a mesma chave para `rag-mcp`, `graph-mcp` e `app-bridge` via Compose.
Nunca exponha essa chave no frontend, browser, prints ou logs.

## 2. Deploy recomendado

Na VPS, dentro do diretorio do projeto:

```bash
git checkout main && \
git pull --ff-only origin main && \
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet && \
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache rag-mcp graph-mcp app-bridge app-frontend && \
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d rag-mcp graph-mcp app-bridge app-frontend && \
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps rag-mcp graph-mcp app-bridge app-frontend hermes-api neo4j
```

Nao apague volumes por padrao. Apagar volumes pode perder memoria, graph,
RAG ou dados operacionais.

## 3. Bootstrap

Bootstrap manual normalmente nao e necessario quando:

- Neo4j ja esta rodando.
- `NEXUS_GRAPH_BOOTSTRAP_ON_START=true`.
- O tenant ja foi inicializado.

Rodar bootstrap manual somente quando:

- Neo4j/volume for novo.
- O tenant for novo.
- `nexus_graph_health` estiver OK, mas o tenant nao tiver seed nodes.

## 4. Checks de saude

Na VPS:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps rag-mcp graph-mcp app-bridge app-frontend hermes-api neo4j && \
curl -fsS http://127.0.0.1:8010/health && echo && \
curl -fsS http://127.0.0.1:8081/health && echo
```

Checar endpoint interno RAG -> Graph sem imprimir a chave:

```bash
KEY="$(grep '^NEXUS_INTERNAL_SYNC_KEY=' .env | cut -d= -f2-)" && \
curl -fsS -H "X-Nexus-Internal-Key: ${KEY}" \
"http://127.0.0.1:8000/internal/graph-sync/sources?tenant=<tenant_id>&collections=courses&limit=1" | head -c 1000 && echo
```

Para ENS:

```bash
KEY="$(grep '^NEXUS_INTERNAL_SYNC_KEY=' .env | cut -d= -f2-)" && \
curl -fsS -H "X-Nexus-Internal-Key: ${KEY}" \
"http://127.0.0.1:8000/internal/graph-sync/sources?tenant=ens&collections=courses&limit=1" | head -c 1000 && echo
```

## 5. Verificar catalogo de tools no Hermes

No NexusAI/Hermes, em um novo chat:

```text
Liste somente os nomes das ferramentas disponiveis no namespace mcp_nexus_graph. Nao execute nenhuma ferramenta.
```

Esperado: a lista deve incluir `nexus_graph_sync_rag_refs`.

Se a tool nao aparecer, recrie `hermes-api` e `app-bridge`:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api app-bridge
```

Depois faca refresh no app e crie novo chat.

## 6. Dry-run RAG -> Graph

No NexusAI/Hermes:

```text
Use nexus_graph_sync_rag_refs em dry_run=true para tenant <tenant_id>, collections courses, marketing, insights e institutional, limit 50, admin_mode=true, validated=true, validation_note="Pre-deploy dry-run aprovado pelo operador". Resuma somente contagens e exemplos de ids; nao copie conteudo longo do RAG.
```

Para ENS:

```text
Use nexus_graph_sync_rag_refs em dry_run=true para tenant ens, collections courses, marketing, insights e institutional, limit 50, admin_mode=true, validated=true, validation_note="Pre-deploy dry-run aprovado pelo operador". Resuma somente contagens e exemplos de ids; nao copie conteudo longo do RAG.
```

## 7. Sync real por colecao

Recomendado rodar por colecao para evitar que uma colecao grande consuma todo
o limite.

### Courses

```text
Execute nexus_graph_sync_rag_refs para tenant <tenant_id>, collections courses, limit 500, admin_mode=true, validated=true, validation_note="Operador aprovou sincronizar referencias leves de cursos do RAG para Graph". Depois resuma source_count, fact_count e relation_count.
```

### Marketing

```text
Execute nexus_graph_sync_rag_refs para tenant <tenant_id>, collections marketing, limit 500, admin_mode=true, validated=true, validation_note="Operador aprovou sincronizar referencias leves de marketing do RAG para Graph". Depois resuma source_count, fact_count e relation_count.
```

### Insights

```text
Execute nexus_graph_sync_rag_refs para tenant <tenant_id>, collections insights, limit 500, admin_mode=true, validated=true, validation_note="Operador aprovou sincronizar referencias leves de insights do RAG para Graph". Depois resuma source_count, fact_count e relation_count.
```

### Institutional

```text
Execute nexus_graph_sync_rag_refs para tenant <tenant_id>, collections institutional, limit 500, admin_mode=true, validated=true, validation_note="Operador aprovou sincronizar referencias leves institucionais do RAG para Graph". Depois resuma source_count, fact_count e relation_count.
```

Para ENS, substitua `<tenant_id>` por `ens`.

## 8. Validacao fina

No NexusAI/Hermes:

```text
Use nexus_graph_query para contar nos por kind: course_ref, marketing_ref, insight_ref e institutional_ref no tenant <tenant_id>. Nao altere nada.
```

Para ENS:

```text
Use nexus_graph_query para contar nos por kind: course_ref, marketing_ref, insight_ref e institutional_ref no tenant ens. Nao altere nada.
```

Tambem valide buscas:

```text
Rode nexus_graph_search por "Curso", depois por "Marketing", depois por "ENS". Confirme se encontrou nos dos tipos course_ref, marketing_ref, insight_ref ou institutional_ref. Nao invente nada se nao encontrar.
```

## 9. Criar cron semanal de sync

Use este prompt no NexusAI/Hermes para automatizar a sync toda segunda-feira
as 12h no horario de Sao Paulo.

```text
Crie um cron recorrente para sincronizar referencias leves do RAG para o Graph MCP toda segunda-feira as 12:00 no timezone America/Sao_Paulo.

Antes de criar, confirme qual timezone o scheduler usa. Se o scheduler aceitar timezone, use America/Sao_Paulo com cron "0 12 * * 1". Se ele so aceitar UTC, use "0 15 * * 1".

Nome do cron: <tenant_id>-rag-graph-sync-weekly
Descricao: Sincroniza referencias leves das colecoes RAG do tenant <tenant_id> para o Graph MCP, sem copiar conteudo longo do RAG.

Acao do cron:
1. Executar nexus_graph_sync_rag_refs para tenant <tenant_id>, collections courses, marketing, insights e institutional, limit 500, admin_mode=true, validated=true, validation_note="Operador aprovou automacao semanal para sincronizar referencias leves do RAG para o Graph toda segunda-feira as 12h America/Sao_Paulo".
2. Depois executar nexus_graph_query em modo read-only para contar nos por kind: course_ref, marketing_ref, insight_ref e institutional_ref no tenant <tenant_id>.
3. Registrar no resultado do cron: source_count, fact_count, relation_count, contagens por kind e qualquer erro retornado.
4. Nao copiar conteudo longo do RAG para o Graph. Nao criar fatos manuais fora do resultado da sync. Nao inventar contagens se alguma ferramenta falhar.

Depois de criar o cron, me mostre: nome, schedule final, timezone efetivo, status ativo/inativo e um resumo da acao configurada.
```

Para ENS, use:

```text
Nome do cron: ens-rag-graph-sync-weekly
tenant ens
```

## 10. Quando reexecutar sync

Reexecute a sync quando:

- O RAG for reindexado.
- Entrarem novos cursos/documentos.
- Alguma colecao for alterada.
- Uma empresa/tenant novo for ativado.

Com o cron semanal ativo, isso fica automatico para manutencao regular.
Para mudancas urgentes, rode a sync manual depois da ingestao do RAG.

## 11. Rollback rapido

Se a camada de roteamento causar comportamento ruim, desligue somente o contrato
de roteamento e reinicie o bridge:

```bash
NEXUS_MEMORY_ROUTING_CONTRACT_ENABLED=false
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d app-bridge
```

Isso nao apaga memoria Hermes, RAG nem Graph.

