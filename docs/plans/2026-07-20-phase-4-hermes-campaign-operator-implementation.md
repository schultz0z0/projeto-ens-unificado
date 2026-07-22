# Phase 4 Hermes Campaign Operator Implementation Plan

> **Baseline aprovado:** 2026-07-22. Executar sequencialmente com TDD e
> registrar RED, GREEN, validação e documentação antes da task seguinte.
>
> **Execucao:** usar TDD task a task, em `main`, sem iniciar trabalho fora do
> baseline documental desta fase. Leituras MCP entram antes das novas mutacoes.

**Goal:** fazer o Hermes consultar e operar objetos reais do `marketing-ops`
via MCP, com confirmacao posterior explicita, auditoria correlacionada, deep
link e falha parcial visivel.

**Architecture:** o `marketing-ops` continua como dominio transacional unico.
Leituras MCP chamam diretamente a camada de dominio existente; escritas novas
entram como actions estendidas de `marketing_ops_prepare_plan_v1` e
`marketing_ops_execute_plan_v1`. O runtime Hermes continua bloqueando mutacoes
diretas. O frontend continua como superficie oficial para abrir o objeto final.

**Stack:** Node 22, TypeScript 5.9, PostgreSQL 17/Supabase, MCP Streamable
HTTP, Express, Zod, Vitest, pgTAP, React 18, Chat Bridge/app-bridge atual e o
fork em `services/hermes-runtime/vendor/hermes-agent`.

## Restricoes globais

- Nao criar nova fonte de verdade fora do `marketing-ops`.
- Nao liberar mutacoes MCP diretas fora do fluxo de plano assinado.
- Nao expor `delegation_token`, `plan_token`, `expected_version` ou scopes ao
  usuario.
- Nao permitir que o Hermes leia agenda/conteudo por SQL direto, REST direto ou
  Supabase direto.
- Nao declarar sucesso quando houver conflito, falha parcial ou indisponibilidade.
- Nao alterar o escopo da Fase 5 para dentro da Fase 4.
- Atualizar `docs/phase-4` no mesmo ciclo de cada task.

## Contratos congelados

- Roadmap e PRD são canônicos.
- Tools diretas legadas de mutação saem do catálogo MCP.
- Escritas usam somente `prepare_plan_v1` e `execute_plan_v1`.
- Auditoria persiste transporte `mcp`, operador `hermes`, chat, run, tool call,
  plano e índice da ação.
- Resultado de plano usa `completed[]`, `failed[]` e `pending[]` por ação.
- RAG fundamenta fatos/tom ENS; Graph atende relações/trabalhos validados.
- Rate limit MCP é por ator e ferramenta.
- Deep links seguem os templates de `docs/phase-4/design.md`.

## Registro obrigatório por task

Ao finalizar cada task:

1. registrar teste RED e motivo da falha em `implementation-progress.md`;
2. registrar comandos GREEN e quantidade de testes;
3. atualizar `requirements-traceability.md` e `risk-register.md`;
4. atualizar o gate aplicável sem marcar evidência não executada;
5. executar regressão do serviço afetado antes da task seguinte.

## Task 1 — Contratos MCP, actions e decisao de schema

**Arquivos principais**

- Modify: `services/marketing-ops/src/mcp/createServer.ts`
- Modify: `services/marketing-ops/src/mcp/contracts.ts`
- Modify: `services/marketing-ops/src/plans/contracts.ts`
- Create: `services/marketing-ops/src/plans/contracts.test.ts`
- Modify: `services/marketing-ops/src/mcp.test.ts`
- Modify: `services/marketing-ops/src/production-gate.test.ts`
- Optional create: `apps/chat-web/supabase/migrations/*_phase_4_hermes_operator_audit.sql`
- Optional create: `apps/chat-web/supabase/tests/marketing_ops_hermes_operator.test.sql`

**Produz:** catalogo final de leituras, actions finais do plano assinado,
scopes minimos, migration aditiva, contexto de auditoria, rate limit por
ator/tool e remoção das tools diretas legadas.

- [ ] RED de contrato para tool discovery, nomes finais e schemas.
- [ ] RED para actions novas de plano, referencias internas e scopes.
- [ ] RED provando que tools diretas legadas não aparecem na descoberta.
- [ ] RED para contexto auditável `hermes` com chat/run/tool/plano/ação.
- [ ] RED para rate limit independente por ator + tool.
- [ ] Criar migration e pgTAP para as colunas/índices congelados no design.
- [ ] GREEN com contracts e testes MCP atualizados.

**Comandos mínimos:**

```bash
cd services/marketing-ops
npm test -- src/plans/contracts.test.ts src/mcp.test.ts src/production-gate.test.ts
cd ../../apps/chat-web
npx supabase test db --local --workdir . supabase/tests/marketing_ops_hermes_operator.test.sql
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
```

## Task 2 — Leituras MCP sobre agenda, timeline, conteudo e capacidades

**Arquivos principais**

- Modify: `services/marketing-ops/src/mcp/createServer.ts`
- Modify: `services/marketing-ops/src/mcp/toolResults.ts`
- Modify: `services/marketing-ops/src/domain/queries.ts`
- Modify: `services/marketing-ops/src/domain/timeline.ts`
- Modify: `services/marketing-ops/src/domain/content.ts`
- Modify: `services/marketing-ops/src/domain/itemArtifacts.ts`
- Modify: `services/marketing-ops/src/mcp.test.ts`

**Produz:** `marketing_ops_list_campaign_items_v1`,
`marketing_ops_get_campaign_timeline_v1`, `marketing_ops_get_content_v1` e
`marketing_ops_get_object_capabilities_v1`.

- [ ] RED para leitura autorizada por papel/tenant.
- [ ] RED para filtros, timezone, cursor e payload pequeno.
- [ ] RED para rate limit de leitura por ator/tool e isolamento entre atores.
- [ ] Implementar adapters MCP reaproveitando dominio da Fase 3.
- [ ] GREEN com contratos, casos de permissao e payloads normalizados.

## Task 3 — Expansao do fluxo `prepare_plan` / `execute_plan`

**Arquivos principais**

- Modify: `services/marketing-ops/src/plans/contracts.ts`
- Modify: `services/marketing-ops/src/plans/executor.ts`
- Modify: `services/marketing-ops/src/plans/executor.test.ts`
- Modify: `services/marketing-ops/src/domain/campaigns.ts`
- Modify: `services/marketing-ops/src/domain/items.ts`
- Modify: `services/marketing-ops/src/domain/content.ts`
- Modify: `services/marketing-ops/src/domain/itemArtifacts.ts`

**Produz:** actions `campaign.update`, `campaign_item.create`,
`campaign_item.reschedule`, `content.create_draft`,
`content.version_create`, `artifact.link_existing` e `campaign.note_add`.

- [ ] RED para conflitos, idempotencia e resultados parciais.
- [ ] RED para `completed[]`, `failed[]`, `pending[]` e dependência falha.
- [ ] RED para retry integral do plano sem duplicar ações já concluídas.
- [ ] RED para `campaign_note_add` append-only e `artifact.link_existing`
  somente com artifact autorizado.
- [ ] Implementar executor estendido sem abrir mutacao direta.
- [ ] GREEN com status `completed`, `partial` e `failed`.

## Task 4 — Tool results, deep links e UX de operador

**Arquivos principais**

- Modify: `services/marketing-ops/src/mcp/toolResults.ts`
- Modify: `services/marketing-ops/src/mcp/createServer.ts`
- Modify: `services/marketing-ops/src/plans/executor.ts`
- Modify: `services/marketing-ops/src/mcp.test.ts`

**Produz:** respostas com `resource_type`, `resource_id`, `label`, `href`,
resultado parcial detalhado e mensagens seguras para conflito/negacao/falha.

- [ ] RED para deep link correto de campanha, item e conteudo.
- [ ] RED para rejeição de UUID/rota inválidos e conteúdo abrindo no item com
  `contentAssetId`.
- [ ] RED para falha parcial e indisponibilidade sem falso sucesso.
- [ ] Implementar mapeamento de deep link no backend.
- [ ] GREEN com payloads pequenos e consistentes com frontend.

## Task 5 — Runtime Hermes, RAG/Graph e skill do operador

**Arquivos principais**

- Modify: `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/SKILL.md`
- Modify: `services/hermes-runtime/vendor/hermes-agent/agent/marketing_ops_delegation.py`
- Modify: `services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py`
- Modify as needed: `services/hermes-runtime/vendor/hermes-agent/agent/tool_executor.py`

**Produz:** skill atualizada para novas leituras, plano ampliado, RAG/Graph,
revisão pelo tom ENS, mensagens de conflito/partial e bloqueio contínuo de
mutações diretas.

- [ ] RED para leitura de agenda/conteudo e execucao de actions novas.
- [ ] RED para bloqueio de qualquer tool mutavel fora do plano.
- [ ] RED para RAG obrigatório em fatos/tom ENS e Graph em cenário relacional.
- [ ] RED para prompt injection em conteúdo não ampliar autoridade.
- [ ] RED para briefing → calendário e chat → versão vinculada.
- [ ] Ajustar binding do runtime sem quebrar cache de prompt.
- [ ] GREEN com runtime ensinando o caminho correto do operador.

## Task 6 — Auditoria, observabilidade e correlacao ponta a ponta

**Arquivos principais**

- Modify: `services/marketing-ops/src/domain/audit.ts`
- Modify: `services/marketing-ops/src/domain/events.ts`
- Modify: `services/marketing-ops/src/domain/queries.ts`
- Modify: `services/marketing-ops/src/production-gate.test.ts`
- Optional modify: migration/testes Supabase da Task 1

**Produz:** trilha suficiente para conectar ator humano, transporte `mcp`,
operador `hermes`, `chat_session_id`, `run_id`, `tool_name`, `tool_call_id`,
`plan_id`, `plan_action_index` e `correlation_id`.

- [ ] RED para correlacao auditavel e redaction de logs.
- [ ] RED provando ausência de briefing/copy/nota/conteúdo integral.
- [ ] RED para retry/conflito/negacao observaveis em metricas e auditoria.
- [ ] Implementar metadados minimos sem vazar segredo.
- [ ] GREEN com consulta/auditoria mostrando a trilha esperada.

## Task 7 — Bridge, frontend e E2E

**Arquivos principais**

- Modify: `apps/chat-web` nas superficies de deep link/feedback da experiencia
  conversacional
- Modify: superficie atual da Bridge/app-bridge que emite delegacao, refresh e
  correlacao de run para o `marketing-ops`
- Modify: suites E2E e smokes integrados do `marketing-ops` e do frontend

**Produz:** jornada real `frontend -> bridge -> Hermes -> MCP -> marketing-ops
-> frontend`, com deep link abrindo o objeto correto e falha operacional
comunicada sem falso sucesso.

- [ ] RED E2E para leitura, prepare, confirmacao e execute.
- [ ] RED para indisponibilidade do `marketing-ops`.
- [ ] RED E2E para briefing → calendário/checklist.
- [ ] RED E2E para resposta do chat → conteúdo versionado.
- [ ] RED E2E para revisão ENS com RAG e relação validada via Graph.
- [ ] RED E2E para conflito → releitura → nova confirmação.
- [ ] RED E2E para delegação expirada/replay e prompt injection.
- [ ] Implementar feedback e abrir deep link no frontend.
- [ ] GREEN com correlacao ponta a ponta.

## Task 8 — Gates, operacao e reconciliacao documental

**Arquivos principais**

- Modify: `docs/phase-4/*.md`
- Modify: `docs/prds/phase-4-hermes-campaign-operator.md` se houver
  reconciliacao final do contrato

**Produz:** gate local completo, runbook executavel, rollback verificavel,
checklist VPS e handoff final da fase.

- [ ] Registrar RED/GREEN por task.
- [ ] Registrar gate local com evidencias reais.
- [ ] Executar build, lint, typecheck, suites e migrations em banco limpo.
- [ ] Validar restart, persistência, backup e rollback local aplicáveis.
- [ ] Preparar deploy controlado e checklist VPS.
- [ ] Registrar comandos de build/deploy VPS e roteiro de testes manuais.
- [ ] Reconciliar README, rastreabilidade, riscos e handoff.

## Gate local planejado

- contratos MCP e runtime Hermes verdes;
- dominio/plano/auditoria verdes;
- E2E ponta a ponta verde;
- retry e conflito cobertos;
- deep link correto;
- logs sem secrets e com correlacao.
- RAG/Graph/tom ENS e conversões do chat validados;
- prompt injection, rate limit e delegação expirada/replay cobertos;
- restart, persistência, backup e rollback registrados.

## Gate VPS planejado

- runtime Hermes com MCP configurado;
- refresh de delegacao validado;
- leitura e mutacao confirmada em ambiente real;
- deep link abrindo a tela correta;
- logs correlacionados;
- jornadas manuais de calendário, conteúdo e tom ENS aprovadas;
- rate limit, conflito e indisponibilidade aprovados;
- persistência após restart e backup confirmados;
- rollback de configuracao validado.

## Sequencia recomendada

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8

Nao inverter Task 5 com Task 2–4. O runtime Hermes deve consumir um contrato
ja estavel do `marketing-ops`, nao um alvo em movimento.
