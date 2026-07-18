# Fase 3 — Design Técnico do Calendário e Esteira de Produção

- **Estado:** `approved`
- **Data:** 2026-07-18
- **Dependência:** Fase 2 `production_validated`
- **PRD:** [phase-3-calendario-esteira-producao.md](../prds/phase-3-calendario-esteira-producao.md)

## 1. Objetivo e limites

Transformar campanhas em trabalho planejado usando o domínio Marketing Ops já
validado. O frontend continua consumindo REST; a camada de domínio continuará
reutilizável pelo MCP futuro. O Supabase do app permanece fonte transacional e
o Artifact Server armazena bytes.

Não entram nesta fase: aprovação institucional, execução de canal, recorrência,
automação Hermes, provedor externo, performance de campanha ou hard delete.

## 2. Baseline existente

`marketing_ops.campaign_items` já possui `id`, `tenant_id`, `campaign_id`,
`kind`, `title`, `content`, `status`, `version`, atores e timestamps. A Fase 1
expôs create/patch legado; a Fase 2 alinhou locks, grants e RLS ao agregado
campanha.

A evolução será aditiva e migrará os registros existentes:

- `kind` será convertido/validado pelos tipos aprovados;
- `content` legado será preservado e convertido em primeira versão somente
  quando houver conteúdo material;
- `draft` permanece `draft`;
- `archived` legado será mapeado para `cancelled`, preservando timestamps e
  auditoria;
- nenhuma linha existente será apagada.

## 3. Arquitetura

```text
React: lista / semana / mês / detalhe
          │ JWT + Idempotency-Key + If-Match
          ▼
Marketing Ops REST v1
          │ adapters estritos
          ▼
Domínio de itens
  ├─ agenda e timezone
  ├─ dependências
  ├─ conteúdo/versionamento
  ├─ ações em lote
  ├─ auditoria/outbox
  └─ projeção de notificações
          │
          ├──────── Artifact Server
          ▼
Supabase app / schema marketing_ops
```

Chat Bridge não recebe CRUD. Hermes não ganha mutação nova nesta fase, mas o
domínio não dependerá de Express para permitir adapters MCP futuros.

## 4. Modelo de dados

### 4.1 `campaign_items`

Evoluir a tabela existente com:

- `kind marketing_ops.item_kind not null`;
- `status marketing_ops.item_status not null`;
- `assignee_user_id uuid null`;
- `priority marketing_ops.item_priority not null default 'normal'`;
- `channel marketing_ops.item_channel null`;
- `description text null`;
- `starts_at timestamptz null`;
- `due_at timestamptz null`;
- `metadata jsonb not null default '{}'`;
- `completed_at timestamptz null`;
- `cancelled_at timestamptz null`.

Tipos:

- `item_kind`: `task|email|whatsapp|post|creative|review|milestone`;
- `item_status`: `draft|ready|in_review|completed|cancelled`;
- `item_priority`: `low|normal|high|urgent`;
- `item_channel`: o mesmo vocabulário controlado de canais da campanha.

Constraints:

- título não vazio e até 200 caracteres;
- `due_at >= starts_at` quando ambos existirem;
- assignee precisa ser membership ativa e autorizado na campanha, validado em
  função/trigger transacional;
- timestamps terminais coerentes com status;
- metadata validada no domínio e limitada em bytes;
- campanha arquivada impede insert/update.

Índices iniciais:

- `(tenant_id, starts_at, id)` para range;
- `(tenant_id, due_at, id)` para prazo/atraso;
- `(tenant_id, campaign_id, status, due_at, id)`;
- `(tenant_id, assignee_user_id, status, due_at, id)`;
- índices devem ser confirmados por `EXPLAIN (ANALYZE, BUFFERS)` com o volume do
  gate, sem duplicação especulativa.

### 4.2 `item_dependencies`

- `tenant_id`, `item_id`, `depends_on_item_id`;
- atores e timestamps;
- PK `(item_id, depends_on_item_id)`;
- FKs compostas por tenant;
- self-loop proibido;
- trigger/função impede campanhas diferentes e ciclos.

A criação adquire advisory locks dos dois itens em ordem crescente dos UUIDs,
depois valida o grafo na mesma transação. A remoção usa a mesma ordem. A
consulta de bloqueio usa `exists` sobre dependências cujo predecessor não está
`completed`.

### 4.3 `content_assets`

- identidade estável: `id`, `tenant_id`, `item_id`;
- `asset_kind`, `title`, `current_version_number`;
- atores, versão otimista e timestamps;
- um item pode ter múltiplos assets.

### 4.4 `content_versions`

- `asset_id`, `version_number`;
- `body text null`, `metadata jsonb`;
- `content_hash` SHA-256;
- `created_by`, `created_at`, `frozen_at`;
- PK `(asset_id, version_number)`.

Versões são append-only. Não existem `UPDATE` ou `DELETE` públicos. A criação
da próxima versão bloqueia o asset, incrementa o contador e atualiza o ponteiro
na mesma transação. `frozen_at` torna explícito o snapshot usado em revisão.

### 4.5 `item_artifacts`

Vínculo entre item/asset e Artifact Server:

- tenant, item, asset opcional, artifact ID/owner;
- MIME, tamanho, SHA-256, timestamps e unlink lógico;
- sem bytes/base64;
- access link curto somente sob demanda e nunca persistido.

### 4.6 `in_app_notifications`

Projeção durável:

- `tenant_id`, `user_id`, `event_key`, `notification_type`;
- referência segura a campanha/item;
- `occurred_at`, `read_at`;
- unique `(tenant_id, user_id, event_key)`.

Eventos de atribuição são escritos na transação da mutação. Prazo próximo e
atraso serão projetados por processo determinístico reexecutável, sem criar
worker de canal externo. Payload guarda IDs e rótulo controlado, não conteúdo.

## 5. Estado do item

```text
draft ──> ready ──> in_review ──> completed
  │          │           │
  └──────────┴───────────┴──────> cancelled
```

- `ready` exige título, assignee e prazo;
- `in_review` exige ao menos uma versão de conteúdo para tipos editoriais;
- `completed` exige dependências concluídas;
- `completed` e `cancelled` são terminais;
- estados `approved|scheduled|executing|failed` não existem no enum público
  desta fase.

## 6. Query canônica de agenda

Uma função/query de domínio recebe:

- intervalo `[from, to)`;
- campanha, tipo, canal, assignee, status e prioridade;
- cursor estável e limite.

Sem intervalo, retorna itens sem data e datados para a lista. Com intervalo,
seleciona itens cuja janela intersecta `[from, to)`:

```text
coalesce(starts_at, due_at) < to
and coalesce(due_at, starts_at) >= from
```

Ordenação canônica: timestamp efetivo asc, prioridade desc, `id` asc. Lista,
semana e mês não implementam queries de negócio divergentes; apenas agrupam a
mesma resposta. O retorno inclui `isOverdue` e `isBlocked` derivados, sem N+1.

## 7. Timezone

- banco persiste `timestamptz`;
- API usa ISO 8601 UTC;
- timezone efetivo vem de configuração do tenant, com fallback explícito
  `America/Sao_Paulo`;
- frontend usa funções puras para converter input local ↔ UTC;
- respostas e formulários exibem o nome IANA;
- limites de dia/semana/mês são convertidos no frontend para UTC antes da
  consulta;
- recorrência e suporte genérico a feriados não entram no corte.

Testes cobrem meia-noite, virada de mês/ano, offsets e um timezone com DST para
provar que não há aritmética manual de offset, mesmo que a ENS use São Paulo.

## 8. API REST

Recursos v1:

- `GET/POST /v1/campaign-items`;
- `GET/PATCH /v1/campaign-items/{itemId}`;
- `POST /v1/campaign-items/{itemId}/transition`;
- `GET/POST/DELETE /v1/campaign-items/{itemId}/dependencies`;
- `GET/POST /v1/campaign-items/{itemId}/content-assets`;
- `GET/POST /v1/content-assets/{assetId}/versions`;
- `POST/DELETE /v1/campaign-items/{itemId}/artifacts`;
- `POST /v1/campaign-items/batch`;
- `GET/PATCH /v1/in-app-notifications`.

Os endpoints legados aninhados em campanha permanecem compatíveis durante a
migração, mas são adaptados ao novo domínio. Query/body desconhecidos falham.
Toda mutação exige `Idempotency-Key`; entidade existente exige `If-Match`.
ETag retorna a versão observada.

## 9. Autorização e RLS

- tenant, ator e papel vêm do JWT/delegação;
- member precisa poder editar a campanha e, conforme ação, ser assignee/owner;
- manager/admin operam o tenant autorizado;
- lote é manager/admin no primeiro corte;
- RLS é habilitada e forçada em todas as tabelas;
- grants são por coluna;
- funções `security definer` fixam `search_path`, validam ator e revogam
  `public`;
- content version e notification são filtradas pelo acesso ao item/campanha;
- usuário inativo, viewer e cross-tenant falham antes de advisory lock.

## 10. Concorrência, idempotência e auditoria

- item usa lock do agregado campanha já validado e row/version lock;
- dependências adquirem locks ordenados;
- asset/version usa lock do asset;
- ações em lote processam IDs em ordem determinística e retornam resultado por
  item;
- replay da mesma idempotency key retorna a mesma resposta;
- chave com payload diferente retorna conflito;
- auditoria registra campos allowlisted e hashes/resumos de conteúdo;
- outbox registra eventos versionados, sem texto livre sensível.

## 11. Frontend

Rotas lazy:

- `/marketing-ops/production`;
- `/marketing-ops/production/week`;
- `/marketing-ops/production/month`;
- `/marketing-ops/production/items/:itemId`.

A lista é implementada primeiro e serve de fallback acessível. Semana/mês
compartilham client, query key, filtros e componente de detalhe. Drag-and-drop
pode ser adicionado depois, mas todos os comandos existem via diálogo/form.

## 12. Observabilidade e performance

Métricas:

- duração/resultados das queries por `view=list|week|month`;
- itens por status/tipo agregados;
- conflito, ciclo rejeitado e ação em lote por resultado;
- versão criada e notificação produzida;
- backlog de eventos.

Gate inicial:

- 50 campanhas, 10.000 itens, 20.000 dependências, 5.000 versões;
- primeira página/lista e intervalo mensal p95 <= 500 ms local;
- detalhe com dependências/versions p95 <= 500 ms;
- zero N+1;
- labels com cardinalidade allowlisted.

## 13. Migration e rollback

Migration aditiva única ou sequência pequena e ordenada:

1. tipos/tabelas/colunas nullable;
2. backfill determinístico dos itens existentes;
3. constraints/índices;
4. RLS/grants/funções/triggers;
5. schema version.

O forward-fix de índice da Fase 2 deve ser aplicado antes ou no mesmo deploy,
em ordem de migration, sem misturar rollback destrutivo.

Rollback normal:

- flags frontend/read/write;
- imagem anterior compatível;
- preservar novas tabelas/colunas;
- não remover versões/auditoria;
- forward-fix para migration aplicada;
- restore somente com backup e autorização explícita.

## 14. Testes e gates

- pgTAP: schema, constraints, RLS, ciclos, imutabilidade e papéis;
- domínio: estados, timezone, dependências, versões, lote;
- integração: CRUD/query/audit/outbox/idempotência/concorrência;
- contrato: REST/OpenAPI/client;
- frontend: lista, semana, mês, URL, teclado, conflito e estados;
- E2E: planejar semana, reagendar, bloquear, versionar e lote;
- Compose: health/readiness, Artifact, restart e persistência;
- segurança: cross-tenant, mass assignment, logs e URLs;
- performance: volume e planos.

## 15. Decisões rejeitadas

- tabela por tipo de item: fragmenta query e regras;
- calendário com query própria: cria divergência;
- datas locais sem timezone: ambíguas;
- editar versão de conteúdo in-place: destrói histórico;
- aprovação fake nesta fase: viola separação das Fases 5/6;
- DAG externo/graph database: complexidade desnecessária;
- lote em transação “tudo ou nada” sem resultado por item: ruim para conflito e
  autorização granular.

## 16. Critério de prontidão

Este design está pronto para implementação porque deriva do schema e das
fronteiras existentes, resolve os pontos funcionais do PRD, define migrations,
segurança, testes, rollback e gate VPS sem antecipar fases futuras.
