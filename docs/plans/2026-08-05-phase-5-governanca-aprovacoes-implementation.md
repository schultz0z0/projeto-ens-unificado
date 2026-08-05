# Phase 5 Governance and Approvals Implementation Plan

**Execution status:** `executed_locally` em 2026-08-05; Supabase implantado;
deploy das imagens e homologação manual na VPS pendentes.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar aprovação editorial e autorização operacional rastreáveis,
com versão/payload congelados, segregação, fila, Hermes limitado à submissão e
pacote imutável pronto para a Fase 6.

**Architecture:** Evoluir verticalmente o `marketing-ops`: migration aditiva no
Supabase do app, domínio compartilhado por REST/MCP, fila React e projeções na
infraestrutura existente de auditoria/outbox/notificações. Decisões são
exclusivamente REST/UI; Hermes submete por plano confirmado e nunca aprova.

**Tech Stack:** PostgreSQL/Supabase + pgTAP, Node.js 22, TypeScript, Express,
Zod, MCP SDK, React/Vite, TanStack Query, Vitest, Testing Library, Playwright,
Docker Compose.

---

## Regras de execução

- Aplicar TDD: RED observável antes de implementação.
- Executar e registrar os testes de cada task antes de avançar.
- Não usar Supabase de produção em testes mutantes.
- Não criar worker/provider ou action MCP de decisão.
- Atualizar `docs/phase-5/implementation-progress.md`,
  `requirements-traceability.md` e evidência aplicável em cada task.
- Commits são locais, pequenos e somente após testes verdes.

### Task 1: Contrato de banco, migration, RLS e pgTAP

**Files:**

- Create: `apps/chat-web/supabase/migrations/20260805120000_phase_5_governance_approvals.sql`
- Create: `apps/chat-web/supabase/tests/marketing_ops_approvals.test.sql`
- Create: `apps/chat-web/supabase/tests/marketing_ops_approvals_rls.test.sql`
- Modify: `services/marketing-ops/src/migration-contract.test.ts`
- Modify: `docs/phase-5/implementation-progress.md`
- Modify: `docs/phase-5/requirements-traceability.md`

**Step 1: Escrever testes pgTAP RED**

Cobrir:

```sql
select has_type('marketing_ops', 'approval_kind');
select has_table('marketing_ops', 'approval_requests');
select has_table('marketing_ops', 'approval_decisions');
select has_table('marketing_ops', 'action_packages');
select col_is_pk(
  'marketing_ops',
  'approval_decisions',
  'id'
);
```

Adicionar cenários negativos para:

- alvo editorial e operacional simultâneos;
- hash/payload alterado;
- `UPDATE/DELETE` em decisão;
- member decidindo;
- autoaprovação operacional;
- cross-tenant.

**Step 2: Executar para confirmar RED**

Run, em `apps/chat-web`:

```bash
npx supabase db reset
```

Expected: FAIL porque tipos/tabelas da Fase 5 ainda não existem.

**Step 3: Implementar migration mínima**

Criar:

```sql
create type marketing_ops.approval_kind as enum ('editorial', 'operational');
create type marketing_ops.approval_status as enum (
  'pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'expired'
);
create type marketing_ops.approval_risk as enum ('low', 'medium', 'high', 'critical');
create type marketing_ops.action_package_status as enum (
  'pending_approval', 'authorized', 'invalidated', 'expired'
);
```

Adicionar as três tabelas do design, FKs compostas por tenant, checks tipados,
índices de fila, triggers append-only, RLS forçada, grants mínimos e helpers
`SECURITY DEFINER` com `search_path` fixo e `PUBLIC EXECUTE` revogado.

**Step 4: Executar reset/pgTAP/lint/diff**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --local
npx supabase db diff --local
```

Expected: reset e pgTAP PASS, lint sem erro e diff vazio.

**Step 5: Executar regressão do contrato de migration**

Run, em `services/marketing-ops`:

```bash
npm test -- src/migration-contract.test.ts
npm run typecheck
```

Expected: PASS.

**Step 6: Atualizar evidência e commit**

```bash
git add apps/chat-web/supabase/migrations/20260805120000_phase_5_governance_approvals.sql apps/chat-web/supabase/tests/marketing_ops_approvals.test.sql apps/chat-web/supabase/tests/marketing_ops_approvals_rls.test.sql services/marketing-ops/src/migration-contract.test.ts docs/phase-5
git commit -m "feat(phase-5): add approval governance schema"
```

### Task 2: Domínio editorial, fila e histórico

**Files:**

- Create: `services/marketing-ops/src/domain/approvals.ts`
- Create: `services/marketing-ops/src/domain/approvals.test.ts`
- Modify: `services/marketing-ops/src/domain/contracts.ts`
- Modify: `services/marketing-ops/src/domain/capabilities.ts`
- Modify: `services/marketing-ops/src/domain/notifications.ts`
- Modify: `docs/phase-5/implementation-progress.md`
- Modify: `docs/phase-5/requirements-traceability.md`

**Step 1: Escrever testes RED do domínio editorial**

Testar:

```ts
it('submits the exact frozen content version', async () => {
  const result = await submitEditorialApproval(context, {
    campaignId,
    assetId,
    versionNumber: 2,
    reason: 'Revisão institucional',
    expiresAt
  });
  expect(result.targetHash).toBe(contentHash);
  expect(result.status).toBe('pending');
});
```

Também cobrir versão inexistente/não congelada, campanha sem acesso,
idempotência, paginação/filtros, detalhe e histórico minimizado.

**Step 2: Confirmar RED**

Run:

```bash
npx vitest run src/domain/approvals.test.ts
```

Expected: FAIL por módulo/funções ausentes.

**Step 3: Implementar contratos e queries**

Adicionar schemas Zod strict para submissão, filtros, decisão e cancelamento.
Implementar `submitEditorialApproval`, `listApprovalRequests`,
`getApprovalRequest` e montagem do snapshot editorial sem copiar body para
auditoria.

**Step 4: Implementar auditoria/outbox/notificação atômicas**

Na mesma transação da submissão:

- request `pending`;
- audit `approval.requested`;
- event `approval.requested.v1`;
- projeção in-app para manager/admin elegíveis;
- idempotency record.

**Step 5: Executar testes e regressão**

```bash
npx vitest run src/domain/approvals.test.ts src/domain/notifications.test.ts src/domain/audit.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

**Step 6: Atualizar evidência e commit**

```bash
git add services/marketing-ops/src/domain docs/phase-5
git commit -m "feat(phase-5): add editorial approval domain"
```

### Task 3: Pacote operacional, decisões, expiração e concorrência

**Files:**

- Create: `services/marketing-ops/src/domain/actionPackages.ts`
- Create: `services/marketing-ops/src/domain/actionPackages.test.ts`
- Create: `services/marketing-ops/src/domain/approvalDecisions.test.ts`
- Create: `services/marketing-ops/scripts/test_approval_decision_concurrency.mjs`
- Modify: `services/marketing-ops/src/domain/approvals.ts`
- Modify: `services/marketing-ops/src/domain/hash.ts`
- Modify: `docs/phase-5/implementation-progress.md`
- Modify: `docs/phase-5/risk-register.md`

**Step 1: Escrever testes RED de pacote**

Usar um payload canônico:

```ts
const action = {
  actionType: 'campaign.channel_dispatch',
  channel: 'email',
  audienceSnapshot: { source: 'test-segment', count: 10 },
  scheduledFor: '2026-08-10T13:00:00.000Z',
  timeZone: 'America/Sao_Paulo',
  configuration: { mode: 'sandbox' },
  successCriteria: 'provider accepted',
  riskSummary: 'homologation only',
  payload: { contentVersion: 2, template: 'test' }
};
```

Verificar hash estável, imutabilidade e criação `pending_approval`.

**Step 2: Escrever testes RED de decisão**

Cobrir:

- manager/admin editorial approve;
- member negado;
- operacional self-approval negada;
- segundo aprovador libera pacote;
- rejeição/ajuste sem comentário negados;
- request expirada não decide;
- versão/hash divergente invalida;
- duas decisões concorrentes: uma efetiva.

**Step 3: Confirmar RED**

```bash
npx vitest run src/domain/actionPackages.test.ts src/domain/approvalDecisions.test.ts
```

Expected: FAIL.

**Step 4: Implementar JSON canônico e comandos**

Implementar `submitOperationalApproval`, `decideApprovalRequest`,
`cancelApprovalRequest` e `expireApprovalRequests`. Bloquear row da
solicitação, revalidar membership/alvo/hash/tempo e gravar decisão + request +
package + audit + outbox atomicamente.

**Step 5: Executar concorrência real**

```bash
node scripts/test_approval_decision_concurrency.mjs
```

Expected: exatamente uma decisão efetiva, nenhuma duplicidade e nenhum
deadlock.

**Step 6: Regressão e commit**

```bash
npm test
npm run typecheck
npm run build
git add services/marketing-ops/src/domain services/marketing-ops/scripts docs/phase-5
git commit -m "feat(phase-5): authorize immutable action packages"
```

### Task 4: REST, OpenAPI, capabilities e SDK frontend

**Files:**

- Create: `services/marketing-ops/src/http/routes/approvals.ts`
- Create: `services/marketing-ops/src/http/routes/approvals.test.ts`
- Modify: `services/marketing-ops/src/http/routes/index.ts`
- Modify: `services/marketing-ops/src/http/createApp.ts`
- Modify: `services/marketing-ops/openapi/marketing-ops.v1.yaml`
- Modify: `services/marketing-ops/src/rest.test.ts`
- Modify: `services/marketing-ops/src/config.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/client.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/client.test.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/types.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/queryKeys.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/queryKeys.test.ts`

**Step 1: Escrever testes RED de REST**

Testar as seis rotas do design, headers `Idempotency-Key`/`If-Match`,
payload strict, filtros/cursor e erros 401/403/404/409/422.

**Step 2: Confirmar RED**

```bash
npx vitest run src/http/routes/approvals.test.ts src/rest.test.ts
```

Expected: FAIL por rotas/OpenAPI ausentes.

**Step 3: Implementar router e OpenAPI em lockstep**

Registrar `registerApprovals` depois do auth middleware. Adicionar schemas,
responses, ETag e capability `governanceApprovalsV1`. A feature fica
default-off em produção até configuração explícita.

**Step 4: Escrever SDK RED e implementar**

Adicionar tipos e funções `listApprovalRequests`, `getApprovalRequest`,
`submitEditorialApproval`, `submitOperationalApproval`, `decideApproval`
e `cancelApproval`.

**Step 5: Regressão**

```bash
npm test
npm run typecheck
npm run build
```

Em `apps/chat-web`:

```bash
npx vitest run src/lib/marketingOps/client.test.ts src/lib/marketingOps/queryKeys.test.ts
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/marketing-ops apps/chat-web/src/lib/marketingOps docs/phase-5
git commit -m "feat(phase-5): expose approval REST contracts"
```

### Task 5: Fila e detalhe de aprovações no frontend

**Files:**

- Create: `apps/chat-web/src/pages/marketing-ops/ApprovalQueuePage.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ApprovalQueuePage.test.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ApprovalDetailPage.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/ApprovalDetailPage.test.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ApprovalFilters.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ApprovalPreview.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ApprovalDecisionDialog.tsx`
- Modify: `apps/chat-web/src/App.tsx`
- Modify: `apps/chat-web/src/components/Sidebar.tsx`
- Modify: `apps/chat-web/src/components/marketing-ops/MarketingOpsMobileBar.tsx`
- Modify: `apps/chat-web/src/lib/marketingOps/flags.ts`

**Step 1: Escrever testes RED da fila**

Cobrir filtros persistidos na URL, paginação, status não dependente de cor,
risco/expiração, loading/vazio/erro/403 e navegação para detalhe.

**Step 2: Escrever testes RED do detalhe**

Cobrir preview editorial/operacional, hash, timezone, histórico, comentário
obrigatório, capabilities e conflito de decisão.

**Step 3: Confirmar RED**

```bash
npx vitest run src/pages/marketing-ops/ApprovalQueuePage.test.tsx src/pages/marketing-ops/ApprovalDetailPage.test.tsx
```

Expected: FAIL.

**Step 4: Implementar UI mínima acessível**

Usar rotas lazy, TanStack Query, componentes de formulário/dialog existentes
e texto “Aprovações de negócio”. Não importar `chat/ApprovalModal.tsx`.

**Step 5: Testar desktop/mobile/axe**

Adicionar cenário Playwright da fila com viewport 390×844 e desktop. Verificar
teclado, foco, labels, contraste e ausência de overflow.

**Step 6: Regressão e commit**

```bash
npm test
npm run lint
npm run typecheck
npm run build
git add apps/chat-web/src docs/phase-5
git commit -m "feat(phase-5): add business approval queue"
```

### Task 6: Ajustes, notificações, métricas e redaction

**Files:**

- Modify: `services/marketing-ops/src/domain/approvals.ts`
- Modify: `services/marketing-ops/src/domain/notifications.ts`
- Modify: `services/marketing-ops/src/domain/notifications.test.ts`
- Modify: `services/marketing-ops/src/observability/metrics.ts`
- Modify: `services/marketing-ops/src/observability/workspaceMetrics.ts`
- Modify: `services/marketing-ops/src/http/createApp.ts`
- Modify: `services/marketing-ops/src/observability/logger.ts`
- Modify: `apps/chat-web/src/components/marketing-ops/InAppNotifications.tsx`
- Modify: `apps/chat-web/src/components/marketing-ops/InAppNotifications.test.tsx`

**Step 1: Escrever testes RED**

Cobrir eventos por transição, dedup, novo ciclo após `changes_requested`,
expiração reexecutável e ausência de payload/body/comentário em logs/labels.

**Step 2: Confirmar RED**

```bash
npx vitest run src/domain/notifications.test.ts src/mcp/observability.test.ts
```

Expected: FAIL.

**Step 3: Implementar projeções e métricas**

Adicionar os oito eventos versionados, notification keys estáveis e métricas
por `kind/status/risk/result` apenas com valores allowlisted.

**Step 4: Atualizar UI de notificações**

Adicionar mensagens seguras e deep links para request sem inserir conteúdo ou
audiência no payload.

**Step 5: Regressão e commit**

```bash
npm test
npm run typecheck
npm run build
```

Executar testes dirigidos do frontend e depois:

```bash
git add services/marketing-ops apps/chat-web/src/components/marketing-ops docs/phase-5
git commit -m "feat(phase-5): project approval lifecycle events"
```

### Task 7: Submissão controlada pelo Hermes/MCP

**Files:**

- Modify: `services/marketing-ops/src/plans/contracts.ts`
- Modify: `services/marketing-ops/src/plans/contracts.test.ts`
- Modify: `services/marketing-ops/src/plans/executor.ts`
- Modify: `services/marketing-ops/src/plans/executor.test.ts`
- Modify: `services/marketing-ops/src/plans/deepLinks.ts`
- Modify: `services/marketing-ops/src/mcp/createServer.ts`
- Modify: `services/marketing-ops/src/mcp/contracts.ts`
- Modify: `services/marketing-ops/src/mcp.test.ts`
- Modify: `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/SKILL.md`
- Modify: `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/references/mcp-contract.md`
- Modify: `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/references/conversation-safety.md`
- Modify: `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/templates/plan-preview.md`
- Modify: `services/chat-bridge/test/marketing-ops-delegation.test.js`
- Modify: `apps/chat-web/e2e/hermes-operator.spec.ts`

**Step 1: Escrever contrato RED**

Adicionar somente:

```ts
type ApprovalPlanAction =
  | { type: 'approval.submit_editorial'; campaign_id: string; asset_id: string; version_number: number; reason: string; expires_at: string }
  | { type: 'approval.submit_operational'; campaign_id: string; action_package: CanonicalActionPackage; reason: string; expires_at: string };
```

Testar que `approval.approve`, `approval.reject` e equivalentes falham no
schema e não aparecem no catálogo.

**Step 2: Confirmar RED**

```bash
npx vitest run src/plans/contracts.test.ts src/plans/executor.test.ts src/mcp.test.ts
```

Expected: FAIL.

**Step 3: Implementar actions via plano**

Resolver alvos por rótulos exatos, calcular scopes mínimos, produzir preview,
executar submissão idempotente e retornar deep link da request. Preservar
confirmação em turno posterior.

**Step 4: Atualizar skill e regressões**

Documentar wire shape exato, separação dos approvals e proibição de decisão.
Adicionar teste que prompt injection não cria scope de decisão.

**Step 5: Executar regressão Bridge/Hermes**

```bash
node --test test/marketing-ops-delegation.test.js
```

Executar também testes dirigidos do runtime vendorizado e E2E fake do operador.
Expected: PASS e zero action de decisão descoberta.

**Step 6: Commit**

```bash
git add services/marketing-ops services/chat-bridge services/hermes-runtime apps/chat-web/e2e docs/phase-5
git commit -m "feat(phase-5): let Hermes submit approval requests"
```

### Task 8: E2E completo, segurança, performance e gate local

**Files:**

- Create: `apps/chat-web/e2e/phase-5-approvals.spec.ts`
- Create: `services/marketing-ops/src/approvals.performance.test.ts`
- Modify: `apps/chat-web/scripts/security_gate.mjs`
- Modify: `docs/phase-5/local-validation.md`
- Modify: `docs/phase-5/implementation-progress.md`
- Modify: `docs/phase-5/requirements-traceability.md`
- Modify: `docs/phase-5/risk-register.md`
- Modify: `docs/phase-5/runbook.md`
- Modify: `docs/phase-5/rollback.md`

**Step 1: Escrever E2E RED**

Jornada:

1. member cria versão e solicita editorial;
2. manager aprova;
3. ajuste cria nova versão/ciclo;
4. member submete operacional;
5. mesmo usuário/solicitante é bloqueado;
6. segundo manager/admin autoriza;
7. request expirada falha;
8. cross-tenant falha;
9. Hermes submete, mas não decide;
10. nenhuma execução externa existe.

**Step 2: Implementar fixtures e fazer E2E GREEN**

Run:

```bash
npx playwright test e2e/phase-5-approvals.spec.ts
```

Expected: PASS em desktop e mobile/axe.

**Step 3: Executar gate completo**

Marketing Ops:

```bash
npm test
npm run typecheck
npm run build
```

Frontend:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run security:gate
```

Banco:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --local
npx supabase db diff --local
```

**Step 4: Performance e restart**

Medir fila com volume representativo e alvo p95 <= 500 ms. Construir Compose,
validar readiness, restart e fingerprints de requests/decisions/packages.

**Step 5: Fechar documentação local**

Registrar comandos, contagens, limitações, riscos e promover somente para
`ready_for_production`.

**Step 6: Commit**

```bash
git add apps/chat-web services/marketing-ops docs/phase-5 roadmap.md docs/prds
git commit -m "test(phase-5): close local governance gate"
```

### Task 9: Deploy controlado e homologação real no navegador

**Files:**

- Modify: `docs/phase-5/supabase-deployment.md`
- Modify: `docs/phase-5/vps-validation.md`
- Modify: `docs/phase-5/runbook.md`
- Modify: `docs/phase-5/implementation-progress.md`
- Modify: `docs/phase-5/requirements-traceability.md`
- Modify: `docs/phase-5/risk-register.md`
- Modify: `docs/phase-5/continuation-handoff.md`
- Modify: `docs/phase-5/README.md`
- Modify: `docs/prds/phase-5-governanca-aprovacoes.md`
- Modify: `docs/prds/README.md`
- Modify: `roadmap.md`

**Step 1: Preparar handoff de deploy**

Confirmar commit, backup, dry-run, imagens, envs/flags e rollback. O usuário ou
responsável autorizado executa push/deploy.

**Step 2: Verificar infraestrutura pós-deploy**

Confirmar commit, migrations, containers, health/readiness, rede, TLS, CORS,
logs, métricas e skill/catálogo MCP.

**Step 3: Homologar manualmente pelo navegador**

O assistente executa integralmente
`docs/phase-5/vps-validation.md` com papéis/fixtures de teste, incluindo
desktop, mobile, teclado, acessibilidade, fila, decisões, segregação,
expiração, Hermes e ausência de execução externa.

**Step 4: Conferir Supabase e trilha**

Validar request, decisão única, package/hash, idempotência, audit/outbox,
notificações, correlation IDs e persistência após restart.

**Step 5: Registrar aceite**

Somente sem falha alta/crítica:

- marcar requisitos `production_validated`;
- fechar/aceitar riscos residuais explicitamente;
- promover PRD/README/roadmap;
- atualizar handoff para `phase_5_closed`.

**Step 6: Commit documental final**

```bash
git add docs/phase-5 docs/prds roadmap.md
git commit -m "docs(phase-5): record production validation"
```

## Resultado esperado

Ao final, frontend e Hermes submetem objetos congelados ao mesmo domínio;
humanos elegíveis decidem na UI; ação operacional exige segregação; pacotes
autorizados são imutáveis e nenhum efeito externo ocorre. A Fase 6 recebe um
contrato verificável, não uma autorização reconstruída.
