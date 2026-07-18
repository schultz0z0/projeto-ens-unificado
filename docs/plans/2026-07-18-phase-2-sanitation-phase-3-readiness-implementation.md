# Phase 2 Sanitation and Phase 3 Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every reproducible Phase 2 gate, reconcile its evidence, and prepare an approved and executable Phase 3 documentation package.

**Architecture:** Keep Phase 2 production behavior unchanged except for a frontend fail-closed parser that replaces unsafe casts. Correct inconsistent pgTAP fixtures and assertions, add an isolated local performance gate around the canonical `listCampaigns` query, then reconcile Phase 2 records and derive Phase 3 design and planning from the existing `campaign_items` aggregate.

**Tech Stack:** React 18, TypeScript, Vitest, PostgreSQL/pgTAP, Supabase CLI, Node.js 22, Docker Desktop, Markdown.

## Global Constraints

- Work only on the canonical `main` branch; do not create a second branch or worktree.
- Do not deploy to remote Supabase, GitHub, or VPS in this cycle.
- Do not weaken RLS, expose raw timeline payloads, or make the RAG transactional.
- Use TDD for production behavior changes and preserve the pgTAP plan count.
- Do not implement Phase 3 functionality or create a Phase 3 migration.
- Do not claim broad adoption or abandonment of spreadsheets without pilot evidence.
- Record every final assertion as `verified_local_2026-07-18`, `production_validated`, `accepted_residual`, or `not_evidenced`.

---

### Task 1: Replace unsafe frontend validation issue casts

**Files:**
- Create: `apps/chat-web/src/lib/marketingOps/validationIssues.ts`
- Create: `apps/chat-web/src/lib/marketingOps/validationIssues.test.ts`
- Modify: `apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx`

**Interfaces:**
- Consumes: unknown error `details` returned by the Marketing Ops client.
- Produces: `validationIssues(value: unknown): ValidationIssue[] | null`, where `ValidationIssue.path` is `(string | number)[]` and `ValidationIssue.message` is a non-empty string.

- [ ] **Step 1: Write the failing parser tests**

```ts
import { describe, expect, it } from 'vitest';
import { validationIssues } from './validationIssues';

describe('validationIssues', () => {
  it('accepts only display-safe validation issues', () => {
    expect(validationIssues({
      issues: [{ path: ['startsOn'], message: 'Data inválida' }]
    })).toEqual([{ path: ['startsOn'], message: 'Data inválida' }]);
  });

  it('fails closed when any issue is malformed', () => {
    expect(validationIssues({ issues: [{ path: ['name'], message: 42 }] })).toBeNull();
    expect(validationIssues({ issues: 'secret' })).toBeNull();
    expect(validationIssues(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm test -- src/lib/marketingOps/validationIssues.test.ts
```

Working directory: `apps/chat-web`

Expected: FAIL because `./validationIssues` does not exist.

- [ ] **Step 3: Implement the minimal fail-closed parser**

```ts
export interface ValidationIssue {
  path: Array<string | number>;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!isRecord(value) || !Array.isArray(value.path) || typeof value.message !== 'string' || value.message.length === 0) {
    return false;
  }
  return value.path.every((segment) => typeof segment === 'string' || typeof segment === 'number');
}

export function validationIssues(value: unknown): ValidationIssue[] | null {
  if (!isRecord(value) || !Array.isArray(value.issues) || !value.issues.every(isValidationIssue)) {
    return null;
  }
  return value.issues;
}
```

In `CampaignWorkspacePage.tsx`, import the helper, compute
`const issues = validationIssues(details.details);`, and render `issues.map`
without `any`.

- [ ] **Step 4: Verify GREEN and lint**

Run:

```powershell
npm test -- src/lib/marketingOps/validationIssues.test.ts src/pages/marketing-ops/CampaignWorkspacePage.test.tsx
npm run lint
npm run typecheck
```

Expected: both test files pass, zero lint errors, and typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/chat-web/src/lib/marketingOps/validationIssues.ts apps/chat-web/src/lib/marketingOps/validationIssues.test.ts apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx
git commit -m "fix: parse workspace validation issues safely"
```

### Task 2: Correct the two inconsistent pgTAP scenarios

**Files:**
- Modify: `apps/chat-web/supabase/tests/marketing_ops_workspace_rls.test.sql`

**Interfaces:**
- Consumes: existing safe timeline projection and RLS policies.
- Produces: 98 pgTAP assertions whose fixtures match their declared roles.

- [ ] **Step 1: Reproduce RED against a clean local database**

Run:

```powershell
npx supabase start --workdir .
npx supabase db reset --local --workdir .
npx supabase test db --local --workdir .
```

Working directory: `apps/chat-web`

Expected: 226/228 pass; the safe timeline assertion and nonparticipant assertion fail.

- [ ] **Step 2: Correct the safe projection assertion**

Replace the `signedUrl` positive predicate with an omission predicate:

```sql
and not timeline.changes @> '[{"field":"signedUrl","kind":"added"}]'::jsonb
```

Keep the positive `briefing` field-name assertion and both secret-content
negative assertions.

- [ ] **Step 3: Add and use a true nonparticipant fixture**

Add this user to the existing `auth.users` fixture list:

```sql
('00000000-0000-0000-0000-000000000000', '15151515-1515-4151-8151-151515151515', 'authenticated', 'authenticated', 'timeline-nonparticipant-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now())
```

Add its active tenant membership, but no `campaign_members` row:

```sql
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '15151515-1515-4151-8151-151515151515', 'member', true)
```

Use `15151515-1515-4151-8151-151515151515` in the nonparticipant timeline
assertion. Keep `select plan(98)`.

- [ ] **Step 4: Verify GREEN and database integrity**

Run:

```powershell
npx supabase test db --local --workdir .
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db diff --local --schema marketing_ops,marketing_ops_private
```

Expected: 228/228 pgTAP tests pass, database lint reports no errors, and schema
diff is empty.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/chat-web/supabase/tests/marketing_ops_workspace_rls.test.sql
git commit -m "test: align workspace timeline pgTAP fixtures"
```

### Task 3: Add the 5,000-campaign list performance gate

**Files:**
- Create: `services/marketing-ops/src/campaignList.performance.test.ts`
- Modify: `services/marketing-ops/package.json`

**Interfaces:**
- Consumes: `listCampaigns(CommandContext, CampaignFilters)` and the disposable local PostgreSQL URL.
- Produces: `npm run test:campaign-list-performance`, a self-cleaning integration gate that reports p95 and fails above 500 ms.

- [ ] **Step 1: Add the failing package-script expectation**

Add to `services/marketing-ops/package.json`:

```json
"test:campaign-list-performance": "vitest run src/campaignList.performance.test.ts --pool=forks --maxWorkers=1"
```

Run:

```powershell
npm run test:campaign-list-performance
```

Expected: FAIL because `src/campaignList.performance.test.ts` does not exist.

- [ ] **Step 2: Add an isolated real-query performance test**

Create a test that:

```ts
const sampleSize = 20;
const limitMs = 500;
const fixturePrefix = `phase2-perf-${randomUUID()}`;
```

It must bulk-insert exactly 5,000 draft campaigns for the seeded
`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` tenant, add the seeded
`11111111-1111-4111-8111-111111111111` actor as primary owner, run five warmup
queries and twenty measured `listCampaigns` calls with `limit: 25`, calculate:

```ts
const p95 = samples.toSorted((left, right) => left - right)[
  Math.ceil(samples.length * 0.95) - 1
];
```

Then assert:

```ts
expect(result.data).toHaveLength(25);
expect(p95).toBeLessThanOrEqual(limitMs);
```

The test must use `try/finally` and delete every campaign whose name begins
with `fixturePrefix`; cascading foreign keys remove its campaign-member rows.
It must log only fixture count, sample count, p95 and limit.

- [ ] **Step 3: Verify GREEN twice**

Run twice:

```powershell
$env:MARKETING_OPS_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55322/postgres'
npm run test:campaign-list-performance
npm run test:campaign-list-performance
```

Expected: both runs pass, each reports p95 <= 500 ms, and cleanup leaves zero
campaigns with the generated prefix.

- [ ] **Step 4: Run Marketing Ops regression**

Run:

```powershell
npm test
npm run test:campaign-concurrency
npm run typecheck
npm run build
```

Expected: all service tests, concurrency paths, typecheck and build pass.

- [ ] **Step 5: Commit**

```powershell
git add -- services/marketing-ops/src/campaignList.performance.test.ts services/marketing-ops/package.json
git commit -m "test: add campaign list performance gate"
```

### Task 4: Reconcile Phase 2 status, decisions, and evidence

**Files:**
- Modify: `Roadmap.md`
- Modify: `docs/prds/README.md`
- Modify: `docs/prds/phase-2-workspace-operacional-mvp.md`
- Modify: every current status/evidence document under `docs/phase-2/`
- Create: `docs/phase-2/decision-log.md`

**Interfaces:**
- Consumes: local gate outputs from Tasks 1–3 and the existing VPS acceptance records.
- Produces: one non-contradictory Phase 2 evidence package using the four evidence classifications in Global Constraints.

- [ ] **Step 1: Record the two approved architectural clarifications**

Create `docs/phase-2/decision-log.md` with:

```markdown
# Registro de decisões da Fase 2

## F2-D-01 — Configurações absorvidas pelos controles funcionais

Status, transições e arquivamento são configurações do ciclo de vida e
permanecem no cabeçalho do workspace. A Fase 2 não cria uma sexta seção vazia.

## F2-D-02 — Hotfix de performance da busca RAG

A migration `2026-07-16-optimize-mcp-search.sql` altera somente a função de
consulta do RAG. Ela não grava dados de campanha, não muda a fonte
transacional e foi homologada na VPS como exceção de performance.
```

- [ ] **Step 2: Reconcile executive states**

Set Phase 2 to `production_validated` in its PRD, README, progress,
traceability and handoff; mark Tasks 1–15 completed; check the 13 PRD acceptance
criteria supported by local and VPS evidence. Preserve the pilot-adoption
outcome as `accepted_residual` rather than claiming broad spreadsheet
replacement.

- [ ] **Step 3: Reconcile evidence documents**

Update:

- `local-validation.md` with dated commands and counts from Tasks 1–3;
- `vps-validation.md` header to `production_validated`, preserving the
  production acceptance table and replacing absolute `file:///` links;
- `requirements-traceability.md` so every F2-RF row points to implementation,
  local evidence and VPS evidence;
- `risk-register.md` so performance is closed by the new gate and adoption
  remains residual;
- `slo.md`, `runbook.md`, `rollback.md`, `lgpd-retention.md` and
  `supabase-deployment.md` so their status matches what was actually executed;
- `continuation-handoff.md` as a historical handoff superseded by the final
  package.

- [ ] **Step 4: Scan for contradictions and broken local links**

Run:

```powershell
rg -n "in_progress|not_started|pending_user_execution|Nenhum requisito está|nenhuma migration.*RAG|file:///" Roadmap.md docs/prds docs/phase-2
git diff --check
```

Expected: remaining matches are explicitly historical or residual; no broken
absolute file link and no whitespace error remains.

- [ ] **Step 5: Commit**

```powershell
git add -- Roadmap.md docs/prds/README.md docs/prds/phase-2-workspace-operacional-mvp.md docs/phase-2
git commit -m "docs: reconcile phase 2 production evidence"
```

### Task 5: Approve and prepare the Phase 3 documentation package

**Files:**
- Modify: `Roadmap.md`
- Modify: `docs/prds/README.md`
- Modify: `docs/prds/phase-3-calendario-esteira-producao.md`
- Create: `docs/phase-3/README.md`
- Create: `docs/phase-3/design.md`
- Create: `docs/phase-3/requirements-traceability.md`
- Create: `docs/phase-3/risk-register.md`
- Create: `docs/phase-3/implementation-progress.md`
- Create: `docs/phase-3/continuation-handoff.md`
- Create: `docs/plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md`

**Interfaces:**
- Consumes: approved Phase 3 PRD and existing `campaign_items` foundation.
- Produces: a `ready_for_implementation` Phase 3 package without code or schema changes.

- [ ] **Step 1: Reconcile and approve the PRD**

Make these decisions explicit:

- initial item states are `draft`, `ready`, `in_review`, `completed`,
  `cancelled`; approval/execution states remain unavailable until Phases 5/6;
- list is the accessible reference view; week and month use the same query;
- UTC persistence and tenant timezone display are mandatory;
- dependencies are directed, same-tenant/same-campaign, and acyclic;
- content identity is separate from immutable versions;
- batch actions are limited to reversible reassignment, priority and
  rescheduling operations;
- notifications are persisted in-app events only;
- no drag-and-drop dependency for acceptance.

Set PRD status to `approved` and leave acceptance checkboxes open for Phase 3
implementation.

- [ ] **Step 2: Write the technical design**

`docs/phase-3/design.md` must define:

- additive evolution of `campaign_items`;
- `item_dependencies`, `content_assets`, `content_versions`,
  `item_artifacts`, and in-app notification projection;
- REST/domain boundaries shared with future MCP use;
- RLS/RBAC, idempotency, optimistic concurrency, audit and outbox rules;
- canonical range query for list/week/month;
- timezone and recurrence non-goals;
- state machines, version immutability and cycle detection;
- testing, observability, migration, rollback and VPS gates.

- [ ] **Step 3: Create governance and traceability documents**

Create the Phase 3 README, initial traceability, risk register, zero-percent
implementation progress and continuation handoff. Every requirement F3-RF-01
through F3-RF-12 must map to a planned design section and implementation task.

- [ ] **Step 4: Write the detailed Phase 3 implementation plan**

Create a TDD plan in `docs/plans/` with independently testable tasks for:

1. gate and schema contracts;
2. item CRUD and state machine;
3. scheduling/timezone query;
4. dependency graph;
5. content versioning and artifacts;
6. REST/OpenAPI and typed client;
7. accessible list view;
8. week/month views;
9. in-app events and batch actions;
10. E2E, performance, documentation and VPS handoff.

Each task must name exact files, interfaces, RED/GREEN commands and commit
boundaries.

- [ ] **Step 5: Validate documentation consistency**

Run:

```powershell
rg -n "T[B]D|T[O]DO|draft|in_progress|production_validated|ready_for_implementation" Roadmap.md docs/prds docs/phase-3 docs/plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md
git diff --check
```

Expected: no placeholder remains; `draft` appears only as a domain state or
historical explanation; Phase 3 is consistently `ready_for_implementation`.

- [ ] **Step 6: Commit**

```powershell
git add -- Roadmap.md docs/prds docs/phase-3 docs/plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md
git commit -m "docs: approve phase 3 implementation package"
```

### Task 6: Run the final regression and issue the entry decision

**Files:**
- Modify: `docs/phase-2/local-validation.md`
- Modify: `docs/phase-2/requirements-traceability.md`
- Modify: `docs/phase-3/README.md`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: final gate matrix and a justified `go` or `no-go` for Phase 3 implementation.

- [ ] **Step 1: Run the clean database gate**

```powershell
npx supabase db reset --local --workdir .
npx supabase test db --local --workdir .
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db diff --local --schema marketing_ops,marketing_ops_private
```

- [ ] **Step 2: Run service and frontend regressions**

Run the full tests, lint, typechecks and builds for `services/marketing-ops`,
`services/artifact-server`, `services/rag-mcp` and `apps/chat-web`, plus
OpenAPI, concurrency, Compose and `security:gate`.

Expected: every mandatory command exits 0. Known non-blocking warnings must be
listed by exact count and category.

- [ ] **Step 3: Review repository state**

```powershell
git diff --check
git status --short --branch
git log -8 --oneline --decorate
```

Expected: no uncommitted file, `main` only, and no accidental remote deploy.

- [ ] **Step 4: Record and commit the final decision**

Record the dated gate matrix. Use `go` only if all mandatory gates are green
and no high/critical unknown remains; otherwise use `no-go` and name the exact
blocker.

```powershell
git add -- docs/phase-2/local-validation.md docs/phase-2/requirements-traceability.md docs/phase-3/README.md
git commit -m "docs: record final phase 3 entry gate"
```
