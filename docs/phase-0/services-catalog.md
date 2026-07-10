# Catálogo de serviços e Compose

## Fontes

- `docker-compose.yml`;
- `docker-compose.prod.yml`;
- Dockerfiles dos apps/serviços;
- package manifests e requirements;
- scripts em `services/hermes-runtime/docker`.

## Topologia resumida

```text
app-frontend
  ├─ app-bridge ── hermes-api ── rag-mcp
  │      │              └─────── graph-mcp ── neo4j
  │      └─ artifact-server
  └─ designer-api

rag-mcp-ingestion-cron ── rag-mcp
hermes-kanban ── hermes-api
```

Todos os serviços ficam na rede `ens-internal`. As portas do Compose base são ligadas a `127.0.0.1`; o override de produção adiciona labels para o Traefik externo já existente.

## Serviços do runtime

| Serviço | Runtime/porta interna | Responsabilidade | Dependências | Persistência | Exposição produção | Classificação |
|---|---|---|---|---|---|---|
| `app-frontend` | Nginx/8080 após build Node 20 | UI React/Vite | bridge e designer saudáveis | imagem estática | Traefik público | `adapt` |
| `app-bridge` | Node 20/8080 | Auth do chat, runs, SSE, sessões, anexos e artefatos | Hermes e Artifact saudáveis | `./data/bridge` e artifacts RO | Traefik público | `keep` |
| `designer-api` | Python 3.11/8090 | Pipeline de geração visual | APIs externas/Supabase conforme env | outputs/tmp/temp | Traefik público | `keep` |
| `artifact-server` | Node 20/8095 | Armazenamento e links temporários de artefatos | Supabase/config interna | `./data/artifacts` | Traefik público | `keep` |
| `hermes-api` | imagem Hermes/8652 | Agente Hermes e API/gateway | RAG e Graph saudáveis | `./data/hermes`, artifacts e inputs | Traefik público protegido por API key | `keep` |
| `hermes-kanban` | imagem Hermes/9119 | Dashboard operacional do runtime Hermes | Hermes API saudável | compartilha estado Hermes | Traefik + basic auth | `keep` |
| `rag-mcp` | Node 22/8000 | Gateway de conhecimento ENS | Supabase/OpenAI conforme env | dados/config versionados e/ou volume | interno, `traefik.enable=false` | `keep` |
| `graph-mcp` | Node 22/8010 | Relações e trabalhos validados | Neo4j saudável, Supabase/RAG | Neo4j/Supabase | interno, `traefik.enable=false` | `keep` |
| `rag-mcp-ingestion-cron` | imagem do RAG | Ingestão recorrente | RAG saudável | usa fontes do RAG | interno | `keep` |
| `neo4j` | Neo4j/7474 e 7687 | Persistência do Nexus Graph | nenhuma | `./data/neo4j` | somente localhost | `keep` |

## Serviços futuros

| Serviço | Fase | Responsabilidade | Relação com serviços atuais |
|---|---|---|---|
| `marketing-ops` | Fase 1 | API + MCP do domínio operacional | Novo; não entra na Chat Bridge |
| worker de outbox | Fase 6 | Execução determinística aprovada | Consome Marketing Ops; credenciais do provedor ficam aqui |
| scheduler proativo | Fase 8 | Avaliar regras e produzir alertas | Consome eventos/métricas, sem executar ação sensível |

## Limites de responsabilidade

### Chat Bridge

Permanece responsável por transporte conversacional. Não receberá CRUD de campanhas, calendário, approval de negócio ou lógica de provedor.

### Hermes API

Raciocina e usa MCPs. Não será fonte transacional e não guardará credenciais de execução de marketing.

### RAG e Graph

RAG contém conhecimento documental; Graph contém relações e memória validada. Nenhum deles substitui o Marketing Ops.

### Artifact Server e Designer

Continuam como serviços especializados. O Marketing Ops guarda referências/ownership, não duplica binários.

## Override de produção

O arquivo `docker-compose.prod.yml`:

- não cria outro Traefik;
- adiciona labels públicos a frontend, bridge, designer, artifacts, Hermes API e dashboard;
- mantém RAG e Graph internos;
- pressupõe Traefik externo com Docker provider;
- não altera a topologia principal nem define o novo Marketing Ops ainda.

## Diretórios históricos fora do runtime

| Caminho | Situação | Classificação |
|---|---|---|
| `services/audit-tmp` | Relatórios e referências de auditorias anteriores; não aparece no Compose | `archive` |
| `infra/hermes` | Template de configuração do Hermes | `keep` |
| `docs/legacy-compose` | Composes históricos | `archive` |

## Riscos observados

1. A VPS depende de um Traefik gerenciado fora deste repositório; o inventário de produção precisa confirmar essa integração.
2. Hermes API e dashboard são públicos por labels; API key/basic auth, TLS e allowlists precisam ser validados no gate VPS.
3. Volumes locais têm ownership/permissões diferentes entre Windows e Linux.
4. `latest` na imagem-base do Hermes reduz reprodutibilidade de builds sem pin/digest.
5. O cron de ingestão e o dashboard compartilham dependências críticas; falhas precisam de observabilidade separada.
6. Docker ausente localmente impede confirmar build/runtime nesta máquina.

## Owner proposto

| Área | Owner proposto |
|---|---|
| Frontend e UX | Engenharia de produto Nexus |
| Chat Bridge e Artifact Server | Plataforma Nexus |
| Designer API | Engenharia de IA visual |
| Hermes runtime | Plataforma de agentes |
| RAG/Graph | Engenharia de conhecimento |
| Neo4j/Supabase/volumes | Plataforma/dados |
| Traefik e VPS | Operação/infraestrutura |
| Marketing Ops futuro | Engenharia de produto + owner funcional de marketing |
