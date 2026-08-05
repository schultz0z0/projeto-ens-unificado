# Design técnico — Fase 5: Governança e Aprovações

- **Estado:** `approved`
- **Data:** 2026-08-05
- **Dependências:** Fases 3 e 4 `production_validated`
- **PRD:** [phase-5-governanca-aprovacoes.md](../prds/phase-5-governanca-aprovacoes.md)

## 1. Objetivo e limites

Adicionar governança editorial e operacional ao `marketing-ops` sem misturar
aprovação de negócio com o modal técnico do Hermes. A fase congela o objeto
avaliado, revalida elegibilidade no instante da decisão e produz um pacote
operacional determinístico para a Fase 6.

Não entram nesta fase: envio/publicação, worker de execução externa, provedor externo, quórum,
workflow genérico, aprovação por IA, múltiplos canais ou alteração de papel.

## 2. Baseline herdado

- `content_assets` possui identidade estável e `content_versions` é
  append-only, com chave `asset_id + version_number`, hash e `frozen_at`;
- `marketing-ops` já centraliza tenant, RBAC, RLS, idempotência, concorrência,
  auditoria e outbox;
- `in_app_notifications` já oferece projeção durável e deduplicável;
- REST e MCP usam a mesma camada de domínio;
- o Hermes escreve somente por `prepare_plan_v1 → confirmação posterior →
  execute_plan_v1`;
- a auditoria da Fase 4 correlaciona chat, run, tool, plano e ação;
- frontend já possui rotas, SDK, query keys, estados de erro e padrões
  responsivos do Workspace/Produção.

## 3. Abordagens avaliadas

### 3.1 Dois fluxos explícitos no Marketing Ops — escolhida

Editorial e operacional compartilham infraestrutura, mas possuem alvos,
elegibilidade e consequências tipadas. Mantém o domínio simples, auditável e
preparado para a Fase 6.

### 3.2 Motor genérico de workflows — rejeitada

Quórum, etapas arbitrárias e políticas configuráveis ampliariam schema, UX e
testes antes de existir caso real que justifique essa generalidade.

### 3.3 Reutilizar approval técnico do Hermes — rejeitada

Viola o ADR 0004: uma tool call aprovada não prova que a versão editorial ou o
payload operacional correto foi decidido por pessoa elegível.

## 4. Arquitetura

```text
Frontend React
  └─ /marketing-ops/approvals
             │ JWT + Idempotency-Key + If-Match
             ▼
Marketing Ops REST
  ├─ fila e detalhe autorizados
  ├─ submissão editorial/operacional
  ├─ decisão transacional e elegibilidade
  └─ cancelamento/expiração
             │
             ├──────── notificações in-app
             ├──────── auditoria + outbox
             ▼
Supabase app / schema marketing_ops
             ▲
Marketing Ops MCP
  └─ Hermes prepara/submete via plano confirmado; nunca decide
```

Chat Bridge continua responsável apenas por conversa e approval técnico. Não
recebe CRUD de governança.

## 5. Modelo de dados

### 5.1 Tipos

- `approval_kind`: `editorial | operational`;
- `approval_status`: `pending | approved | rejected |
  changes_requested | cancelled | expired`;
- `approval_risk`: `low | medium | high | critical`;
- `action_package_status`: `pending_approval | authorized | invalidated |
  expired`.

Estado de execução não entra nesses enums.

### 5.2 `approval_requests`

Campos principais:

- `id`, `tenant_id`, `campaign_id`, `kind`, `status`;
- `requested_by`, `reason`, `risk_level`, `expires_at`;
- alvo editorial: `content_asset_id`, `content_version_number`,
  `target_hash`;
- alvo operacional: `action_package_id`, `target_hash`;
- `supersedes_request_id` para novo ciclo após ajuste;
- `version`, `created_at`, `updated_at`.

Constraint tipada exige alvo editorial ou operacional, nunca ambos. A
solicitação é mutável somente na máquina de estado; alvo, hash, solicitante e
snapshot não mudam.

### 5.3 `approval_decisions`

Ledger append-only:

- `id`, `tenant_id`, `request_id`;
- `decision`, `decision_origin`, `decided_by`, `decider_role`; decisões humanas
  exigem ator/papel e expiração automática usa origem `system` sem atribuição humana;
- comentário redigido/limitado, `correlation_id`, `created_at`;
- contexto de elegibilidade suficiente para auditoria, sem copiar secrets ou
  conteúdo integral.

Cada transição efetiva gera uma linha. Rejeição e `changes_requested`
exigem comentário. Cancelamento e expiração também são registrados.

### 5.4 `action_packages`

- `id`, `tenant_id`, `campaign_id`, `created_by`;
- `action_type`, `channel`, `audience_snapshot`, `scheduled_for`,
  `time_zone`, `configuration`, `success_criteria`, `risk_summary`;
- `payload` canônico, `payload_hash`, `status`;
- `authorized_by_request_id`, `authorized_at`, `expires_at`;
- timestamps e referência de invalidação.

O pacote nasce em `pending_approval`. Payload, audiência, canal, horário,
configuração e hash são imutáveis desde a submissão. A decisão apenas libera o
mesmo pacote; não reconstrói conteúdo. A Fase 6 poderá consumir somente
`authorized`, não expirado e não invalidado.

### 5.5 Imutabilidade e hashes

- hash editorial reutiliza `content_versions.content_hash` e inclui
  identidade canônica do asset/versão no snapshot de decisão;
- hash operacional usa JSON canônico versionado;
- triggers impedem `UPDATE/DELETE` dos alvos congelados e do payload;
- qualquer divergência invalida o ciclo e exige nova solicitação;
- texto livre não entra em labels de métricas nem snapshots de auditoria.

## 6. Máquinas de estado

```text
pending ──► approved
   ├──────► rejected
   ├──────► changes_requested
   ├──────► cancelled
   └──────► expired
```

Todos os estados finais são terminais. Ajuste não reabre a solicitação: uma
nova versão/pacote cria nova solicitação ligada por `supersedes_request_id`.
Expiração é aplicada por worker interno reexecutável, em lotes limitados com
`SKIP LOCKED` e identidade explícita de sistema. Leituras permanecem sem efeito
colateral; uma tentativa de decisão vencida dispara primeiro a mesma transição
durável em transação separada e depois retorna conflito.

## 7. Elegibilidade e segregação

- `member`: prepara e submete dentro de campanha editável; não decide;
- `manager`: decide editorial e operacional no tenant autorizado;
- `admin`: mesmas decisões e administração futura de políticas;
- editorial permite que manager/admin decida solicitação própria;
- operacional exige `decided_by <> requested_by`;
- elegibilidade, membership, papel, campanha, status, expiração e hash são
  revalidados na transação da decisão;
- frontend apenas reflete capabilities; serviço e RLS decidem.

Quórum, aprovadores nomeados e políticas por tenant ficam fora do primeiro
corte. A superfície será aditiva para permitir evolução posterior.

## 8. Domínio e transações

Comandos propostos:

- `submitEditorialApproval`;
- `submitOperationalApproval`;
- `listApprovalRequests`;
- `getApprovalRequest`;
- `decideApprovalRequest`;
- `cancelApprovalRequest`;
- `expireApprovalRequests`.

Submissão grava solicitação, auditoria, outbox, idempotência e notificações na
mesma transação. Decisão bloqueia a solicitação, revalida tudo, grava ledger e
libera/invalida o pacote quando aplicável. Duas decisões concorrentes resultam
em uma vencedora e uma resposta estável de conflito/estado terminal.

## 9. REST

Rotas v1:

- `GET /v1/approval-requests`;
- `POST /v1/approval-requests/editorial`;
- `POST /v1/approval-requests/operational`;
- `GET /v1/approval-requests/:requestId`;
- `POST /v1/approval-requests/:requestId/decisions`;
- `POST /v1/approval-requests/:requestId/cancel`.

Filtros: tipo, status, campanha, solicitante, risco, vencimento e cursor.
Mutações exigem `Idempotency-Key`; decisão/cancelamento exigem `If-Match`.
Payloads são strict e erros preservam `code`, `message`, `correlationId`
e detalhes seguros.

## 10. MCP e Hermes

Novas capacidades entram como actions de plano, não como tools mutáveis
diretas:

- `approval.submit_editorial`;
- `approval.submit_operational`.

O Hermes consulta versão/pacote e capabilities, prepara preview com rótulos
exatos, recebe confirmação em turno posterior e então submete. Não serão
expostas actions `approve`, `reject`, `changes_requested` ou `cancel` ao
Hermes. Decisão de negócio ocorre na UI REST por humano elegível.

## 11. Frontend

Rotas lazy:

- `/marketing-ops/approvals`;
- `/marketing-ops/approvals/:requestId`.

A lista canônica oferece filtros persistidos na URL, paginação e estados
loading/vazio/sem resultado/erro/403. O detalhe mostra:

- tipo, campanha, solicitante, risco, expiração e status;
- preview fiel da versão editorial ou payload operacional;
- destaque de público, canal, horário e timezone;
- hash abreviado e identidade do alvo;
- histórico de decisões e ciclo anterior;
- ações permitidas com comentário obrigatório onde aplicável.

O nome visual será “Aprovações de negócio”. Nenhum componente, endpoint ou
estado do `ApprovalModal` técnico será reutilizado.

## 12. Notificações e eventos

Eventos versionados:

- `approval.requested.v1`;
- `approval.approved.v1`;
- `approval.rejected.v1`;
- `approval.changes_requested.v1`;
- `approval.cancelled.v1`;
- `approval.expired.v1`;
- `action_package.authorized.v1`;
- `action_package.invalidated.v1`.

Projeções in-app usam chaves deduplicáveis e payload allowlisted. Canais
externos não entram na fase.

## 13. Segurança e privacidade

- deny-by-default em REST, domínio, RLS e grants;
- package/version/hash revalidados na decisão;
- anti-replay e idempotência em todas as mutações;
- comentários tratados como entrada não confiável, com limite e redaction;
- nenhum HTML de conteúdo é renderizado sem sanitização;
- audience/payload sensível é minimizado na UI, logs e auditoria;
- links de artifact seguem ownership existente;
- nenhuma decisão chama worker/provedor de execução externa; somente a transição
  interna de expiração pode ser consolidada antes de recusar uma decisão vencida;
- tenant, papel e solicitante nunca vêm de campo confiado do cliente.

## 14. Observabilidade

Métricas de baixa cardinalidade:

- solicitações por tipo/status/risco;
- duração até decisão;
- decisões por resultado;
- ajustes, rejeições, cancelamentos e expirações;
- tentativas não autorizadas e autoaprovação operacional bloqueada;
- conflitos concorrentes;
- pacotes autorizados/invalidados;
- notificações produzidas;
- correlação até audit/outbox.

## 15. Testes

- pgTAP: schema, constraints, imutabilidade, RLS, grants e cross-tenant;
- domínio: estados, elegibilidade, segregação, expiração, hashes,
  idempotência, concorrência e rollback;
- REST/OpenAPI: contratos strict, headers, filtros, erros e capabilities;
- MCP: actions de submissão, confirmação, scopes e ausência de decisão;
- frontend: fila, detalhe, preview, comentário, URL, teclado, responsividade;
- E2E: member solicita, manager decide, ajuste cria novo ciclo, operacional
  bloqueia autoaprovação e admin distinto autoriza;
- segurança: replay, XSS, mass assignment, papel/tenant forjado e hash divergente;
- operação: restart, persistência, métricas, logs e rollback.

## 16. Migration e rollback

Migration aditiva cria tipos, tabelas, constraints, índices, funções, RLS,
grants e testes. Não altera o enum público de `campaign_items` nem reescreve
versões existentes.

Rollback normal desliga flags de leitura/escrita, reimplanta imagem anterior e
preserva schema/dados. Migration aplicada recebe forward-fix; drop/restore só
com backup e autorização explícita.

## 17. Gates

Gate local: migrations limpas, pgTAP, testes, build/lint/typecheck, E2E,
segurança, acessibilidade, concorrência, restart, persistência, documentação e
rollback.

Gate VPS: depois do deploy do responsável, o assistente testa manualmente o
site pelo navegador com papéis de teste, confirma Supabase/auditoria/eventos,
reinício, logs, responsividade e ausência de execução externa.

## 18. Critério de saída para a Fase 6

A Fase 6 só pode iniciar quando um `action_package` autorizado é imutável,
hash/expiração/segregação estão comprovados, nenhum endpoint de decisão causa
efeito externo e a homologação VPS da Fase 5 está `production_validated`.
