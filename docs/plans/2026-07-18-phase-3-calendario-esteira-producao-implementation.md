# Phase 3 Calendário e Esteira de Produção Implementation Plan

> **Execução:** usar `superpowers:executing-plans` e
> `superpowers:test-driven-development` task a task. A execução ocorre
> diretamente em `main`, por decisão explícita do usuário.

**Goal:** Entregar itens operacionais, lista/semana/mês, dependências, conteúdo
versionado, artifacts, notificações in-app e ações seguras em lote, mantendo
segurança e operação validadas nas Fases 1–2.

**Architecture:** Evolução aditiva de `campaign_items` no Supabase do app.
Frontend React consome REST v1; adapters chamam uma camada de domínio
independente do transporte. Uma query por intervalo abastece todas as views.
Conteúdo separa asset e versões append-only; bytes ficam no Artifact Server.

**Stack:** PostgreSQL 17/Supabase CLI 2.109, pgTAP, Node 22, TypeScript 5.9,
Express, Zod, React 18, TanStack Query, date-fns, Vitest, Testing Library,
Playwright, axe-core e Docker Compose.

## Restrições globais

- Não criar branch além de `main`.
- Não implementar estados `approved`, `scheduled`, `executing` ou `failed`.
- Não implementar recorrência, aprovação, disparo, provider, automação Hermes
  ou drag-and-drop obrigatório.
- Toda mutação REST usa `Idempotency-Key`; existente usa `If-Match`.
- Banco persiste instantes UTC; frontend exibe timezone IANA efetivo.
- Tenant/papel/ator são derivados no servidor.
- RLS forçada, grants por coluna e auditoria/outbox são obrigatórios.
- Versões de conteúdo são append-only.
- Lista é a referência acessível e deve existir antes de semana/mês.
- Teste RED precisa ser executado antes da implementação correspondente.
- Atualizar documentação/evidência no mesmo ciclo de cada task.
- Commits são locais; o agente não faz `git push` nem deploy VPS.
- O forward-fix da Fase 2 deve estar no dry-run do próximo deploy Supabase.

## Task 1 — Gate, schema e contratos

**Arquivos**

- Create: `apps/chat-web/supabase/migrations/20260718195000_phase_3_calendar_production_pipeline.sql`
- Create: `apps/chat-web/supabase/tests/marketing_ops_calendar.test.sql`
- Create: `apps/chat-web/supabase/tests/marketing_ops_calendar_rls.test.sql`
- Modify: `services/marketing-ops/src/domain/contracts.ts`
- Modify: `services/marketing-ops/src/domain/contracts.test.ts`
- Modify: `docs/phase-3/implementation-progress.md`
- Modify: `docs/phase-3/requirements-traceability.md`

**Produz:** tipos, evolução de `campaign_items`, tabelas auxiliares, backfill,
constraints, RLS, grants e contratos Zod.

- [ ] Escrever REDs pgTAP para enums, colunas, FKs, índices, RLS forçada,
  grants, backfill `archived → cancelled` e preservação de IDs/versões.
- [ ] Escrever REDs unitários para tipos/metadata/status reservados e datas.
- [ ] Executar RED:

```powershell
Set-Location apps/chat-web
npx supabase test db --local --workdir . supabase/tests/marketing_ops_calendar.test.sql supabase/tests/marketing_ops_calendar_rls.test.sql
Set-Location ../../services/marketing-ops
npx vitest run src/domain/contracts.test.ts
```

- [ ] Implementar migration aditiva conforme o design, incluindo
  `item_dependencies`, `content_assets`, `content_versions`,
  `item_artifacts` e `in_app_notifications`.
- [ ] Implementar schemas Zod estritos.
- [ ] Executar GREEN e regressão:

```powershell
Set-Location apps/chat-web
npx supabase db reset --local --workdir .
npx supabase test db --local --workdir .
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db diff --local --schema marketing_ops,marketing_ops_private
Set-Location ../../services/marketing-ops
npx vitest run src/domain/contracts.test.ts
npm run typecheck
```

- [ ] Atualizar progresso/rastreabilidade e commit:

```powershell
git add -- apps/chat-web/supabase services/marketing-ops/src/domain/contracts.ts services/marketing-ops/src/domain/contracts.test.ts docs/phase-3
git commit -m "feat: add phase 3 schema contracts"
```

## Task 2 — CRUD e máquina de estados

**Arquivos**

- Modify: `services/marketing-ops/src/domain/items.ts`
- Create: `services/marketing-ops/src/domain/items.test.ts`
- Modify: `services/marketing-ops/src/auth/permissions.ts`
- Modify: `services/marketing-ops/src/domain/audit.ts`
- Modify: `services/marketing-ops/src/domain/events.ts`
- Modify: `services/marketing-ops/src/production-gate.test.ts`

**Produz:** create/get/update/transition/cancel com versão, idempotência,
readiness e terminalidade.

- [ ] REDs para create, patch mínimo, campanha arquivada, assignee sem acesso,
  datas inválidas, todos os edges, estados reservados, 409 e replay.
- [ ] Executar RED:

```powershell
Set-Location services/marketing-ops
npx vitest run src/domain/items.test.ts src/production-gate.test.ts
```

- [ ] Implementar domínio usando `withActorTransaction`, locks do agregado,
  audit minimizada e eventos versionados.
- [ ] GREEN:

```powershell
npx vitest run src/domain/items.test.ts src/production-gate.test.ts
npm test
npm run typecheck
npm run build
```

- [ ] Atualizar docs e commit:

```powershell
git add -- services/marketing-ops/src docs/phase-3
git commit -m "feat: implement production item lifecycle"
```

## Task 3 — Agenda, query canônica e timezone

**Arquivos**

- Create: `services/marketing-ops/src/domain/scheduling.ts`
- Create: `services/marketing-ops/src/domain/scheduling.test.ts`
- Modify: `services/marketing-ops/src/domain/queries.ts`
- Modify: `services/marketing-ops/src/domain/queries.test.ts`
- Modify: `services/marketing-ops/src/config.ts`
- Create: `services/marketing-ops/src/schedule.performance.test.ts`
- Modify: `services/marketing-ops/package.json`

**Produz:** range `[from,to)`, filtros, cursor, atraso/bloqueio derivados,
timezone efetivo e gate de volume.

- [ ] REDs para interseção de intervalo, sem data, filtros combinados, cursor,
  virada de mês/ano, São Paulo e timezone com DST.
- [ ] RED de performance com 10.000 itens e p95 <= 500 ms.
- [ ] Executar RED:

```powershell
Set-Location services/marketing-ops
npx vitest run src/domain/scheduling.test.ts src/domain/queries.test.ts
npx vitest run src/schedule.performance.test.ts --pool=forks --maxWorkers=1
```

- [ ] Implementar query única sem N+1, timezone IANA/fallback e índices apenas
  após revisar `EXPLAIN (ANALYZE, BUFFERS)`.
- [ ] GREEN:

```powershell
npx vitest run src/domain/scheduling.test.ts src/domain/queries.test.ts
npm run test:schedule-performance
npm run typecheck
npm run build
```

- [ ] Commit:

```powershell
git add -- services/marketing-ops docs/phase-3
git commit -m "feat: add canonical production schedule query"
```

## Task 4 — Dependências acíclicas

**Arquivos**

- Create: `services/marketing-ops/src/domain/dependencies.ts`
- Create: `services/marketing-ops/src/domain/dependencies.test.ts`
- Create: `apps/chat-web/scripts/test_item_dependency_concurrency.mjs`
- Modify: `apps/chat-web/supabase/tests/marketing_ops_calendar.test.sql`
- Modify: `apps/chat-web/supabase/tests/marketing_ops_calendar_rls.test.sql`

**Produz:** add/remove/list, detecção de ciclo e bloqueio.

- [ ] REDs para self-loop, duplicata, cross-campaign, cross-tenant, ciclo
  indireto, item terminal, ator sem acesso e bloqueio derivado.
- [ ] RED concorrente com inserções A→B e B→A; harness deve terminar sem
  deadlock e aceitar no máximo uma aresta.
- [ ] Implementar locks por UUID ordenado e validação transacional do grafo.
- [ ] GREEN:

```powershell
Set-Location services/marketing-ops
npx vitest run src/domain/dependencies.test.ts
Set-Location ../../apps/chat-web
npx supabase test db --local --workdir . supabase/tests/marketing_ops_calendar.test.sql supabase/tests/marketing_ops_calendar_rls.test.sql
node scripts/test_item_dependency_concurrency.mjs
```

- [ ] Commit:

```powershell
git add -- services/marketing-ops/src/domain apps/chat-web/scripts apps/chat-web/supabase/tests docs/phase-3
git commit -m "feat: enforce acyclic item dependencies"
```

## Task 5 — Conteúdo, versões e artifacts

**Arquivos**

- Create: `services/marketing-ops/src/domain/content.ts`
- Create: `services/marketing-ops/src/domain/content.test.ts`
- Create: `services/marketing-ops/src/domain/itemArtifacts.ts`
- Create: `services/marketing-ops/src/domain/itemArtifacts.test.ts`
- Modify: `services/marketing-ops/src/integrations/artifactClient.ts`
- Modify: `services/marketing-ops/src/integrations/artifactClient.test.ts`
- Modify: `apps/chat-web/supabase/tests/marketing_ops_calendar.test.sql`
- Modify: `apps/chat-web/supabase/tests/marketing_ops_calendar_rls.test.sql`

**Produz:** asset, versão append-only, freeze, histórico e artifact seguro.

- [ ] REDs para primeira/próxima versão, hash, corrida de número, tentativa de
  update/delete, freeze, cross-tenant, owner incorreto, compensação e unlink.
- [ ] Implementar lock do asset, incremento atômico, audit com hash/resumo e
  integração Artifact já validada.
- [ ] GREEN:

```powershell
Set-Location services/marketing-ops
npx vitest run src/domain/content.test.ts src/domain/itemArtifacts.test.ts src/integrations/artifactClient.test.ts
Set-Location ../../apps/chat-web
npx supabase test db --local --workdir . supabase/tests/marketing_ops_calendar.test.sql supabase/tests/marketing_ops_calendar_rls.test.sql
```

- [ ] Commit:

```powershell
git add -- services/marketing-ops apps/chat-web/supabase/tests docs/phase-3
git commit -m "feat: add immutable content versions and item artifacts"
```

## Task 6 — REST, OpenAPI e client tipado

**Arquivos**

- Modify: `services/marketing-ops/src/http/routes/items.ts`
- Create: `services/marketing-ops/src/http/routes/dependencies.ts`
- Create: `services/marketing-ops/src/http/routes/content.ts`
- Create: `services/marketing-ops/src/http/routes/notifications.ts`
- Modify: `services/marketing-ops/src/http/routes/index.ts`
- Modify: `services/marketing-ops/src/rest.test.ts`
- Modify: `services/marketing-ops/openapi/marketing-ops.v1.yaml`
- Modify: `apps/chat-web/src/lib/marketingOps/types.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/client.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/client.test.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/queryKeys.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/queryKeys.test.ts`

**Produz:** contrato v1 completo, compatibilidade legada e SDK frontend.

- [ ] REDs para inventário path+método, schemas strict, query desconhecida,
  mutation headers, ETag/409, range/filtros, dependências, versões e artifacts.
- [ ] Implementar adapters sem regra de domínio e client que preserva auth,
  correlação, ETag, idempotência e `currentVersion`.
- [ ] GREEN:

```powershell
Set-Location services/marketing-ops
npx vitest run src/rest.test.ts
npx --yes @redocly/cli@2.18.1 lint openapi/marketing-ops.v1.yaml --extends=minimal
npm run typecheck
npm run build
Set-Location ../../apps/chat-web
npx vitest run src/lib/marketingOps/client.test.ts src/lib/marketingOps/queryKeys.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add -- services/marketing-ops apps/chat-web/src/lib/marketingOps docs/phase-3
git commit -m "feat: expose phase 3 REST and typed client"
```

## Task 7 — Lista acessível

**Arquivos**

- Create: `apps/chat-web/src/pages/marketing-ops/ProductionListPage.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ProductionListPage.test.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ProductionFilters.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ProductionItemDialog.tsx`
- Create: `apps/chat-web/src/lib/marketingOps/scheduleUrl.ts`
- Create: `apps/chat-web/src/lib/marketingOps/scheduleUrl.test.ts`
- Modify: `apps/chat-web/src/App.tsx`
- Modify: `apps/chat-web/src/components/layout/AppSidebar.tsx`

**Produz:** referência funcional para criar, filtrar, listar, editar,
reagendar e transicionar sem calendário/drag.

- [ ] REDs para URL, filtros, paginação, sem data, atraso/bloqueio, criação,
  formulário timezone, teclado, 403/404/409 e estados vazios.
- [ ] Implementar rota lazy e UI responsiva com tabela/cards.
- [ ] GREEN:

```powershell
Set-Location apps/chat-web
npx vitest run src/pages/marketing-ops/ProductionListPage.test.tsx src/lib/marketingOps/scheduleUrl.test.ts
npm run lint
npm run typecheck
npm run build
```

- [ ] Commit:

```powershell
git add -- apps/chat-web/src docs/phase-3
git commit -m "feat: add accessible production list"
```

## Task 8 — Semana e mês

**Arquivos**

- Create: `apps/chat-web/src/pages/marketing-ops/ProductionWeekPage.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ProductionWeekPage.test.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ProductionMonthPage.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ProductionMonthPage.test.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ProductionCalendar.tsx`
- Create: `apps/chat-web/src/lib/marketingOps/timezone.ts`
- Create: `apps/chat-web/src/lib/marketingOps/timezone.test.ts`
- Modify: `apps/chat-web/src/App.tsx`

**Produz:** agrupamentos semana/mês equivalentes à lista.

- [ ] REDs para mesma query key/filtros, limites UTC, virada mês/ano,
  timezone, foco/teclado, overflow e abertura de detalhe.
- [ ] Implementar sem drag obrigatório; toda ação reutiliza diálogo da lista.
- [ ] GREEN:

```powershell
Set-Location apps/chat-web
npx vitest run src/pages/marketing-ops/ProductionWeekPage.test.tsx src/pages/marketing-ops/ProductionMonthPage.test.tsx src/lib/marketingOps/timezone.test.ts
npm test
npm run lint
npm run typecheck
npm run build
```

- [ ] Commit:

```powershell
git add -- apps/chat-web/src docs/phase-3
git commit -m "feat: add production week and month views"
```

## Task 9 — Notificações in-app e lote

**Arquivos**

- Create: `services/marketing-ops/src/domain/notifications.ts`
- Create: `services/marketing-ops/src/domain/notifications.test.ts`
- Create: `services/marketing-ops/src/domain/batch.ts`
- Create: `services/marketing-ops/src/domain/batch.test.ts`
- Modify: `services/marketing-ops/src/http/routes/notifications.ts`
- Modify: `services/marketing-ops/src/http/routes/items.ts`
- Create: `apps/chat-web/src/components/marketing-ops/InAppNotifications.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/InAppNotifications.test.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ProductionBatchDialog.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ProductionBatchDialog.test.tsx`

**Produz:** atribuição/prazo/atraso deduplicáveis e três ações reversíveis.

- [ ] REDs para event key, replay, payload seguro, read, tenant, prazo/atraso,
  autorização de lote, versão por item, resultado parcial explícito e ordem.
- [ ] Implementar projeção reexecutável e lote somente manager/admin.
- [ ] GREEN:

```powershell
Set-Location services/marketing-ops
npx vitest run src/domain/notifications.test.ts src/domain/batch.test.ts
Set-Location ../../apps/chat-web
npx vitest run src/components/marketing-ops/InAppNotifications.test.tsx src/components/marketing-ops/ProductionBatchDialog.test.tsx
```

- [ ] Commit:

```powershell
git add -- services/marketing-ops apps/chat-web/src docs/phase-3
git commit -m "feat: add in-app events and safe batch actions"
```

## Task 10 — E2E, performance, operação e handoff

**Arquivos**

- Modify: `apps/chat-web/e2e/marketing-ops.spec.ts`
- Create: `scripts/test/phase-3-vps.sh`
- Create: `scripts/test/phase-3-vps-safety.test.mjs`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `services/marketing-ops/src/observability/metrics.ts`
- Modify: `services/marketing-ops/src/observability/logger.ts`
- Modify: `services/marketing-ops/src/observability/readiness.ts`
- Create: `docs/phase-3/local-validation.md`
- Create: `docs/phase-3/runbook.md`
- Create: `docs/phase-3/rollback.md`
- Create: `docs/phase-3/supabase-deployment.md`
- Create: `docs/phase-3/vps-validation.md`
- Modify: `docs/phase-3/README.md`
- Modify: `docs/phase-3/implementation-progress.md`
- Modify: `docs/phase-3/requirements-traceability.md`
- Modify: `docs/phase-3/risk-register.md`
- Modify: `Roadmap.md`
- Modify: `docs/prds/phase-3-calendario-esteira-producao.md`

**Produz:** gate local reproduzível e handoff de produção, sem executar push/VPS.

- [ ] REDs E2E para planejar semana, reagendar, criar/resolver bloqueio,
  versionar, artifact, lote, notificação, member/manager/admin e mobile/axe.
- [ ] Instrumentar métricas allowlisted e logs redigidos.
- [ ] Criar script VPS fail-closed, fixtures marcadas e cleanup garantido.
- [ ] Gate DB fresco:

```powershell
Set-Location apps/chat-web
npx supabase db reset --local --workdir .
npx supabase test db --local --workdir .
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db diff --local --schema marketing_ops,marketing_ops_private
```

- [ ] Regressão completa:

```powershell
Set-Location services/marketing-ops
npm test
npm run test:campaign-list-performance
npm run test:schedule-performance
npm run typecheck
npm run build
npx --yes @redocly/cli@2.18.1 lint openapi/marketing-ops.v1.yaml --extends=minimal

Set-Location ../artifact-server
npm test

Set-Location ../rag-mcp
npm test
npm run typecheck

Set-Location ../../apps/chat-web
npm test
npm run lint
npm run typecheck
npm run build
npm run e2e
npm run security:gate
node ../../scripts/test/phase-3-vps-safety.test.mjs
```

- [ ] Validar Compose config/build/up, health/readiness, restart e persistência
  localmente.
- [ ] Atualizar matriz final. Se algum gate obrigatório estiver vermelho,
  manter `in_progress` e registrar bloqueador.
- [ ] Commit de fechamento interno:

```powershell
git add -- Roadmap.md docs/prds docs/phase-3 scripts/test apps/chat-web/e2e docker-compose.yml docker-compose.prod.yml services/marketing-ops/src/observability
git commit -m "docs: prepare phase 3 production handoff"
```

## Deploy posterior ao fechamento interno

Não executar durante implementação parcial.

1. Confirmar Supabase do app, backup e hashes.
2. Revisar `migration list` e `db push --linked --dry-run`; deve incluir o
   índice pendente da Fase 2 e migrations aprovadas da Fase 3.
3. Aplicar, executar lint/advisors e invariantes.
4. Usuário publica `main`.
5. Usuário executa deploy VPS com o runbook.
6. Agente conduz logs, smokes, E2E, restart, cleanup e rollback.
7. Somente após aceite promover Fase 3 a `production_validated`.
