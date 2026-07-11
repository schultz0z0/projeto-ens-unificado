# Phase 1 Marketing Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking. Parallel agents are prohibited by the user for this execution.

**Goal:** Entregar a fundação completa do Marketing Ops com API, MCP, identidade, tenant, RBAC, RLS, auditoria, idempotência, concorrência, outbox, observabilidade, SDK frontend e gates reproduzíveis.

**Architecture:** Um serviço TypeScript/Node 22 expõe REST e MCP sobre a mesma camada de domínio PostgreSQL. O banco operacional é o Supabase do app em schema privado `marketing_ops`; a Bridge emite delegações curtas para o Hermes, e o Supabase do RAG permanece isolado.

**Tech Stack:** Node.js 22, TypeScript 5.9, Express 4.22, MCP SDK 1.29, Zod 3.25, PostgreSQL/Supabase CLI 2.109, `pg`, `jose`, Vitest 3.2, pgTAP, Docker Compose.

## Global Constraints

- O `.env` da raiz é a única fonte global de runtime; valores secretos nunca são impressos ou copiados para arquivos versionados.
- `marketing-ops` usa somente o Supabase do app; `rag-mcp` usa somente o Supabase do RAG.
- Produção não é mutada durante o gate local.
- REST e MCP chamam as mesmas funções de domínio.
- Nenhuma mutação ocorre sem ator, tenant, correlation ID e idempotency key validados.
- RLS e grants são explícitos; service role nunca entra no frontend.
- `user_metadata` não participa de autorização.
- Flags desligam rollout, mas nunca substituem RBAC/RLS/scopes.
- Toda nova função de produção nasce após teste vermelho observado.
- O gate local pode promover a fase a `ready_for_production`; somente o gate VPS promove a `production_validated`/`completed`.

---

### Task 1: Reparar os gates de baseline do monorepo

**Files:**
- Modify: `scripts/validate.sh`
- Modify: `apps/chat-web/package.json`
- Modify: `apps/chat-web/vite.config.ts`
- Test: `scripts/validate.sh`
- Test: `apps/chat-web/src/**/*.test.ts`

**Interfaces:**
- Produces: `npm test`, `npm run typecheck` e `bash scripts/validate.sh` reproduzíveis sem secrets reais.

- [x] **Step 1: Reproduzir as duas falhas atuais**

Run: `bash scripts/validate.sh` e `npm test` em `apps/chat-web`.

Expected: falha por diretório `packages/` ausente e por env Supabase de teste ausente.

- [x] **Step 2: Corrigir o validador de roots**

Usar apenas roots existentes ao chamar `find`:

```bash
search_roots=(apps services infra scripts docs)
[ -d packages ] && search_roots+=(packages)
nested_git_count=$(find "${search_roots[@]}" -name .git -print | wc -l | tr -d ' ')
```

- [x] **Step 3: Criar configuração Vitest segura**

`vite.config.ts` deve usar valores locais não secretos apenas em teste, preservando plugins e aliases existentes:

```ts
export default defineConfig({
  test: {
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'local-test-anon-key'
    }
  }
});
```

Adicionar scripts `test` e `typecheck` ao package do frontend.

- [x] **Step 4: Verificar os gates reparados**

Run: `bash scripts/validate.sh`, `npm test`, `npm run typecheck` e `npm run build`.

Expected: exit `0` em todos.

- [x] **Step 5: Commit**

Run: `git commit -m "test: torna gates locais reproduziveis"`.

### Task 2: Reconciliar e baselinar o Supabase do app

**Files:**
- Create: `apps/chat-web/supabase/config.toml`
- Create: `apps/chat-web/supabase/legacy_migrations/README.md`
- Move: `apps/chat-web/supabase/migrations/*.sql` para `apps/chat-web/supabase/legacy_migrations/`
- Create via CLI: `apps/chat-web/supabase/migrations/*_app_schema_baseline.sql` (usar exatamente o caminho impresso por `supabase migration new`)
- Create: `docs/phase-1/supabase-baseline.md`
- Create outside Git: `%TEMP%/nexus-phase-1/app-schema.sql`
- Create outside Git: `%TEMP%/nexus-phase-1/app-data.sql`

**Interfaces:**
- Produces: cadeia limpa reproduzível do app e procedimento exato de reparo de histórico para deploy.
- Preserves: migrations históricas sem exclusão.

- [x] **Step 1: Inicializar pelo CLI oficial**

Run: `npx supabase init` em `apps/chat-web`.

Expected: `supabase/config.toml` criado sem sobrescrever migrations.

- [x] **Step 2: Inspecionar remoto sem imprimir credenciais**

Carregar nomes `NEXUS_SUPABASE_ACCESS_TOKEN`, `NEXUS_SUPABASE_PROJECT_REF` e `NEXUS_SUPABASE_DB_PASSWORD` do `.env` raiz apenas no processo. Executar `supabase link`, `migration list`, `db advisors --type security` e dumps schema/data para `%TEMP%`.

Expected: conexão somente leitura, arquivos de backup fora do Git e relatório sem valores secretos.

- [x] **Step 3: Gerar baseline pelo CLI**

Run: `npx supabase migration new app_schema_baseline` e preencher o arquivo com dump schema-only revisado do remoto.

Expected: arquivo nomeado pelo CLI.

- [x] **Step 4: Arquivar cadeia histórica quebrada**

Mover os arquivos anteriores para `legacy_migrations` e registrar versões, razão, hash do dump e comandos de reparo em `supabase-baseline.md`.

- [x] **Step 5: Validar bootstrap limpo**

Run: `npx supabase start`, `npx supabase db reset --local --no-seed`, `npx supabase db lint --local --level error --fail-on error`.

Expected: baseline aplicado do zero e lint sem erro.

- [x] **Step 6: Commit**

Run: `git commit -m "chore: reconcilia baseline do supabase do app"`.

### Task 3: Criar schema, RLS, grants e testes pgTAP

**Files:**
- Create: `apps/chat-web/supabase/tests/marketing_ops_foundation.test.sql`
- Create via CLI: `apps/chat-web/supabase/migrations/*_marketing_ops_foundation.sql` (usar exatamente o caminho impresso por `supabase migration new`)
- Create: `apps/chat-web/supabase/seed.sql`

**Interfaces:**
- Produces tables: `marketing_ops.tenants`, `memberships`, `campaigns`, `campaign_members`, `campaign_items`, `audit_events`, `domain_events`, `idempotency_records`, `delegation_uses`, `schema_versions`.
- Produces helpers: `marketing_ops_private.current_tenant_id()`, `current_actor_role(text)`, `can_access_campaign(uuid)`.

- [x] **Step 1: Escrever testes pgTAP antes da migration**

Cobrir existência, PK/FK/checks, índices de RLS, grants explícitos, ausência de grants `anon`, imutabilidade de auditoria, member/manager/admin e cross-tenant.

- [x] **Step 2: Observar RED**

Run: `npx supabase test db --local supabase/tests/marketing_ops_foundation.test.sql`.

Expected: falha porque schema/tabelas não existem.

- [x] **Step 3: Criar migration pelo CLI e implementar o mínimo**

Run: `npx supabase migration new marketing_ops_foundation`.

A migration deve criar schemas privados, tipos, tabelas, índices, triggers de imutabilidade, policies e grants na mesma transação lógica.

- [x] **Step 4: Seed local identificado**

Criar três usuários Auth de teste e memberships `member`, `manager`, `admin` no tenant `ens`, além de um segundo tenant isolado.

- [x] **Step 5: Observar GREEN e advisors**

Run: `npx supabase db reset --local`, `npx supabase test db --local supabase/tests`, `npx supabase db advisors --local --type security --fail-on error`.

Expected: pgTAP verde, zero advisor de erro.

- [x] **Step 6: Commit**

Run: `git commit -m "feat: cria fundacao transacional do marketing ops"`.

### Task 4: Scaffold do serviço, config, erros e observabilidade

**Files:**
- Create: `services/marketing-ops/package.json`
- Create: `services/marketing-ops/package-lock.json`
- Create: `services/marketing-ops/tsconfig.json`
- Create: `services/marketing-ops/Dockerfile`
- Create: `services/marketing-ops/src/config.ts`
- Create: `services/marketing-ops/src/errors.ts`
- Create: `services/marketing-ops/src/observability/logger.ts`
- Create: `services/marketing-ops/src/observability/metrics.ts`
- Create: `services/marketing-ops/src/http/createApp.ts`
- Create: `services/marketing-ops/src/index.ts`
- Test: corresponding `*.test.ts` files.

**Interfaces:**
- `loadConfig(env: NodeJS.ProcessEnv): AppConfig`
- `appError(code, status, message, details?): AppError`
- `createLogger(sink): Logger`
- `createMetrics(): MetricsRegistry`
- `createApp(deps): Express`

- [x] **Step 1: Criar package e instalar versões exatas**

Instalar sem ranges: MCP `1.29.0`, Express `4.22.2`, Zod `3.25.76`, `pg` `8.22.0`, `jose` `6.2.3`, TypeScript `5.9.3`, Vitest `3.2.6`, `@types/pg` `8.20.0`, `@types/express` `4.17.25` e `@types/node` `22.19.20`.

- [x] **Step 2: Escrever testes de config/erro/log/métricas**

Testar placeholders, produção fail-closed, redaction, envelope estável, contadores e correlation ID.

- [x] **Step 3: Observar RED**

Run: `npm test`.

Expected: módulos ausentes.

- [x] **Step 4: Implementar scaffold mínimo**

Health deve responder sem banco; readiness deve consultar dependências; shutdown encerra HTTP e pool com `SIGTERM`/`SIGINT`.

- [x] **Step 5: Verificar GREEN/build/typecheck**

Run: `npm test`, `npm run typecheck`, `npm run build`.

- [x] **Step 6: Commit**

Run: `git commit -m "feat: cria scaffold observavel do marketing ops"`.

### Task 5: Identidade, tenant, RBAC e transação RLS

**Files:**
- Create: `services/marketing-ops/src/auth/supabaseAuth.ts`
- Create: `services/marketing-ops/src/auth/actor.ts`
- Create: `services/marketing-ops/src/auth/permissions.ts`
- Create: `services/marketing-ops/src/db/pool.ts`
- Create: `services/marketing-ops/src/db/actorTransaction.ts`
- Test: corresponding unit and integration tests.

**Interfaces:**
- `verifySupabaseBearer(token): Promise<SupabaseUser>`
- `resolveActor(userId, requestedTenantId?): Promise<Actor>`
- `authorize(actor, permission): void`
- `withActorTransaction(actor, correlationId, fn): Promise<T>`

- [x] **Step 1: Testes vermelhos de auth e RBAC**

Cobrir token ausente/inválido/expirado, tenant forjado, papel enviado pelo cliente, membership inativa e matriz completa.

- [x] **Step 2: Testes vermelhos de contexto PostgreSQL**

Provar que claims locais são definidos e que rollback sempre ocorre em erro.

- [x] **Step 3: Implementar e verificar GREEN**

Run: `npm test` com `MARKETING_OPS_TEST_DATABASE_URL` apontando ao Supabase local.

- [x] **Step 4: Commit**

Run: `git commit -m "feat: aplica identidade tenant e rbac"`.

### Task 6: Domínio idempotente de campanhas e itens

**Files:**
- Create: `services/marketing-ops/src/domain/hash.ts`
- Create: `services/marketing-ops/src/domain/idempotency.ts`
- Create: `services/marketing-ops/src/domain/campaigns.ts`
- Create: `services/marketing-ops/src/domain/items.ts`
- Create: `services/marketing-ops/src/domain/audit.ts`
- Create: `services/marketing-ops/src/domain/events.ts`
- Test: unit and database integration tests.

**Interfaces:**
- `hashCanonicalPayload(value): string`
- `executeIdempotentCommand(ctx, operation, key, payload, command): Promise<CommandResult>`
- `createCampaignDraft(ctx, input): Promise<Campaign>`
- `updateCampaignDraft(ctx, id, expectedVersion, input): Promise<Campaign>`
- `archiveCampaign(ctx, id, expectedVersion): Promise<Campaign>`
- `createCampaignItemDraft(ctx, campaignId, input): Promise<CampaignItem>`
- `updateCampaignItemDraft(ctx, campaignId, itemId, expectedVersion, input): Promise<CampaignItem>`

- [x] **Step 1: Testes vermelhos de hash/idempotência/versão**

Mesmo payload deve gerar mesmo hash; mesma key/payload retorna resultado; payload divergente conflita; versão obsoleta não altera linha.

- [x] **Step 2: Testes vermelhos de atomicidade**

Injetar falha depois do write e provar ausência de entidade, auditoria e evento órfão.

- [x] **Step 3: Implementar comandos mínimos**

Cada comando grava entidade, `audit_events`, `domain_events` e `idempotency_records` na mesma transação.

- [x] **Step 4: Verificar GREEN**

Run: unitários e integração contra Supabase local.

- [x] **Step 5: Commit**

Run: `git commit -m "feat: adiciona dominio idempotente de drafts"`.

### Task 7: REST API e contrato OpenAPI

**Files:**
- Create: `services/marketing-ops/openapi/marketing-ops.v1.yaml`
- Create: `services/marketing-ops/src/http/middleware.ts`
- Create: `services/marketing-ops/src/http/routes/capabilities.ts`
- Create: `services/marketing-ops/src/http/routes/campaigns.ts`
- Create: `services/marketing-ops/src/http/routes/items.ts`
- Create: `services/marketing-ops/src/http/routes/audit.ts`
- Test: route and contract tests.

**Interfaces:** endpoints definidos em `docs/phase-1/design.md`; mutações exigem `Idempotency-Key` e retornam `X-Correlation-Id`.

- [x] **Step 1: Escrever testes HTTP vermelhos**

Cobrir auth, CORS, payload, rate limit, paginação, filtros, erros, idempotência e ETag/version.

- [x] **Step 2: Implementar rotas sobre o domínio**

Não duplicar SQL ou regra nas rotas.

- [x] **Step 3: Validar OpenAPI**

Testar que toda rota e código de erro está no YAML e que exemplos respeitam schemas.

- [x] **Step 4: Verificar GREEN e commit**

Run: `npm test && npm run typecheck && npm run build`.

Commit: `feat: expoe api v1 do marketing ops`.

### Task 8: MCP e delegação verificável

**Files:**
- Create: `services/marketing-ops/src/delegation/claims.ts`
- Create: `services/marketing-ops/src/delegation/verifier.ts`
- Create: `services/marketing-ops/src/mcp/createServer.ts`
- Create: `services/marketing-ops/src/mcp/toolResults.ts`
- Create: `services/marketing-ops/src/mcp/contracts.ts`
- Test: delegation and MCP tests.

**Interfaces:**
- `verifyDelegation(token, requiredScopes, operation?): Promise<DelegatedActor>`
- `createMarketingOpsMcpServer(deps): McpServer`

- [x] **Step 1: Testes vermelhos de token**

Cobrir assinatura, `kid`, issuer, audience, TTL, `nbf`, tenant, role, scope, replay e rotação ativa/anterior.

- [x] **Step 2: Testes vermelhos de tools**

Health/capabilities funcionam sem delegação; domínio falha sem token; API e MCP leem o mesmo registro; write exige idempotência.

- [x] **Step 3: Implementar MCP stateless Streamable HTTP**

Registrar tools versionadas descritas no design e mapear erros ao resultado MCP seguro.

- [x] **Step 4: Verificar GREEN e commit**

Commit: `feat: expoe mcp com delegacao confiavel`.

### Task 9: Hardening da Bridge e emissão de delegação

**Files:**
- Modify: `services/chat-bridge/package.json`
- Modify: `services/chat-bridge/package-lock.json`
- Modify: `services/chat-bridge/src/tenant-context.js`
- Create: `services/chat-bridge/src/runtime-config.js`
- Create: `services/chat-bridge/src/marketing-ops-delegation.js`
- Modify: `services/chat-bridge/src/hermes-payloads.js`
- Modify: `services/chat-bridge/src/server.js`
- Test: Bridge tests.

**Interfaces:**
- `validateBridgeRuntimeConfig(env): BridgeRuntimeConfig`
- `issueMarketingOpsDelegation(runContext, scopes): Promise<string>`
- `withMarketingOpsDelegation(message, token): message`
- `redactMarketingOpsDelegation(input): input`

- [x] **Step 1: Testes vermelhos de hardening**

`user_metadata` ignorado; produção sem Supabase falha; fallback local exige flag explícita; papel sempre vem do perfil.

- [x] **Step 2: Testes vermelhos de emissão**

Claims, TTL, `kid`, scopes e correlação exatos; token não persiste em `run.input` nem aparece em logs.

- [x] **Step 3: Implementar com `jose` pinado**

Emitir somente chave ativa e injetar o token no contexto técnico da run Hermes; redigir persistência diagnóstica.

- [x] **Step 4: Verificar 55 testes existentes + novos**

Run: `npm test`.

- [x] **Step 5: Commit**

Commit: `feat: endurece bridge e delega ator ao marketing ops`.

### Task 10: Registrar MCP no Hermes sem tocar no RAG/Graph

**Files:**
- Modify: `services/hermes-runtime/docker/ensure-ens-rag-mcp.py`
- Modify: `services/hermes-runtime/docker/tests/test_ensure_ens_rag_mcp.py`
- Modify: `infra/hermes/config.yaml`
- Modify: `services/hermes-runtime/docker/hermes-api-server.sh`
- Modify: `services/hermes-runtime/docker/hermes-kanban-dashboard.sh`

**Interfaces:** servidor `nexus_marketing_ops` em `http://marketing-ops:8091/mcp`, sampling desabilitado.

- [x] **Step 1: Teste Python vermelho**

Exigir terceiro MCP preservando custom servers e sem alterar URLs do RAG/Graph.

- [x] **Step 2: Implementar registro idempotente**

Adicionar URL/timeouts sem chave de ator estática; a delegação é argumento por tool.

- [x] **Step 3: Verificar testes Hermes Docker**

Run: `python -m pytest services/hermes-runtime/docker/tests -q`.

- [x] **Step 4: Commit**

Commit: `feat: registra marketing ops no hermes`.

### Task 11: SDK frontend, flags e deep links

**Files:**
- Create: `apps/chat-web/src/lib/marketingOps/types.ts`
- Create: `apps/chat-web/src/lib/marketingOps/client.ts`
- Create: `apps/chat-web/src/lib/marketingOps/flags.ts`
- Create: `apps/chat-web/src/lib/marketingOps/deepLinks.ts`
- Create: corresponding tests.

**Interfaces:**
- `createMarketingOpsClient({baseUrl, getAccessToken})`
- `marketingOpsFlags(env)`
- `campaignDeepLink(id)` e `parseMarketingOpsDeepLink(url)`

- [x] **Step 1: Testes vermelhos**

Cobrir refresh de token por chamada, correlation ID, erros tipados, flags default off/kill switch e IDs sem cópia de estado.

- [x] **Step 2: Implementar SDK sem adicionar telas da Fase 2**

O client não contém service role nem tenant confiável; `X-Tenant-Id` é apenas seleção validada no servidor.

- [x] **Step 3: Verificar frontend completo**

Run: test, typecheck, lint, build e security gate.

- [x] **Step 4: Commit**

Commit: `feat: adiciona sdk frontend do marketing ops`.

### Task 12: Compose, env, health e operação

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `scripts/validate.sh`
- Modify: `scripts/bootstrap.sh`
- Create: `docs/phase-1/runbook.md`
- Create: `docs/phase-1/rollback.md`
- Create: `docs/phase-1/slo.md`
- Create: `docs/phase-1/lgpd-retention.md`

**Interfaces:** serviço interno `marketing-ops:8091`, porta host opcional loopback, health/readiness e volume inexistente porque estado é PostgreSQL.

- [x] **Step 1: Escrever checks de Compose que falham sem serviço**

Validar serviço, network, healthcheck, dependências, envs e ausência de secrets em build args.

- [x] **Step 2: Adicionar serviço e variáveis globais**

Separar URL pública, origins, database URL, internal key, feature flags e keyring; manter RAG intocado.

- [x] **Step 3: Documentar deploy, backup, restore, rollback, SLO e retenção**

Runbook inclui baseline history repair apenas após dump/hash/schema diff e nunca em teste automatizado de produção.

- [x] **Step 4: Verificar Compose e commit**

Run: `docker compose --env-file .env.example config` e `bash scripts/validate.sh`.

Commit: `feat: integra marketing ops ao compose`.

### Task 13: Gate integrado local e segurança

**Files:**
- Create: `services/marketing-ops/test/integration/e2e.test.ts`
- Create: `scripts/test/phase-1-local.sh`
- Create: `docs/phase-1/local-validation.md`

**Interfaces:** comando único `bash scripts/test/phase-1-local.sh`.

- [x] **Step 1: Subir Supabase local e Compose da fase**

Buildar imagem, iniciar dependências necessárias e aguardar health/readiness.

- [x] **Step 2: Executar E2E REST/MCP**

Criar draft via API, ler via MCP, repetir idempotência, forçar versão obsoleta, negar cross-tenant e provar rollback atômico.

- [x] **Step 3: Reiniciar serviço e provar persistência**

Recriar somente `marketing-ops`, reler dados e validar outbox/auditoria.

- [x] **Step 4: Executar todos os gates**

Monorepo validation; testes/build/typecheck de Bridge, Marketing Ops, RAG, Graph, Artifact e frontend; pgTAP; advisors; audits; Compose; scan de secrets/bundle.

- [x] **Step 5: Registrar evidências exatas**

`local-validation.md` lista comandos, versões, contagens, duração, limitações e resultado sem secrets.

- [x] **Step 6: Commit**

Commit: `test: valida fase 1 localmente`.

### Task 14: Rastreabilidade, PRD, roadmap e revisão final

**Files:**
- Create: `docs/phase-1/requirements-traceability.md`
- Create: `docs/phase-1/risk-register.md`
- Create: `docs/phase-1/vps-validation.md`
- Modify: `docs/phase-1/README.md`
- Modify: `docs/phase-0/phase-1-backlog.md`
- Modify: `docs/prds/phase-1-fundacao-marketing-ops.md`
- Modify: `docs/prds/README.md`
- Modify: `Roadmap.md`

**Interfaces:** cada requisito F1-RF e item F1-001–F1-108 aponta para código, teste e evidência.

- [x] **Step 1: Revisar requisito por requisito**

Nenhum checkbox fecha apenas por existência de código; exigir teste/evidência.

- [x] **Step 2: Atualizar estado correto**

Se gate local passar, usar `ready_for_production`; `vps-validation.md` permanece `pending_user_deploy` até evidência real.

- [x] **Step 3: Executar revisão de segurança e código da branch inteira**

Inspecionar diff desde `b3fc5dd`, procurar falhas de auth, tenant, RLS, replay, secrets, concorrência, transação e rollback; corrigir achados antes de concluir.

- [x] **Step 4: Verificação final fresca**

Reexecutar comando único da fase, `git diff --check`, links Markdown e status Git.

- [x] **Step 5: Commit final**

Commit: `docs: registra gate local da fase 1`.

## Self-Review

- F1-RF-01: Tasks 4 e 12.
- F1-RF-02: Tasks 5 e 7.
- F1-RF-03: Task 8.
- F1-RF-04: Tasks 8, 9 e 10.
- F1-RF-05–08: Tasks 2, 3 e 5.
- F1-RF-09–12: Tasks 3 e 6.
- F1-RF-13–14: Tasks 4, 7 e 8.
- F1-001–003: Tasks 2 e 3; limpeza remota permanece condicionada ao deploy com backup.
- F1-004–014: Tasks 3–10 e 12–13.
- F1-101–108: Tasks 1, 6, 7, 11–14.
- Fronteiras: nenhuma tarefa escreve no Supabase do RAG.
- Segurança: user metadata, RLS, grants, replay, service role e bundle têm testes negativos.
- Atomicidade: entidade, auditoria, evento e idempotência são validados na mesma transação.
- Operação: baseline, backup, restore, rollback, Compose, restart e VPS possuem artefatos próprios.
- Escopo: telas completas, aprovações editoriais e execução externa permanecem fora da Fase 1.
