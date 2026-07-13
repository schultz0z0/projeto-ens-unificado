# Phase 1 Marketing Ops Conversational Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hermes plan every Marketing Ops mutation conversationally and execute the exact plan only after one explicit user confirmation.

**Architecture:** The Bridge adds a conservative, signed confirmation claim to fresh per-turn delegations. Marketing Ops issues stateless signed plan tokens and executes their exact operations only on a later confirmed turn. A mandatory Hermes skill/contract shapes natural conversation, while the fork executor blocks direct low-level mutation tools.

**Tech Stack:** Node.js ESM, TypeScript, JOSE/JWT, Zod, MCP SDK, Python Hermes fork, Vitest, Node test runner, pytest, Docker Compose.

## Global Constraints

- Work inline in this session; do not use parallel agents.
- Development and local validation run on Windows; production remains Ubuntu Linux.
- The root `.env` is global; app Supabase and RAG Supabase remain separate.
- Do not add a Supabase migration or persist pending plans in Marketing Ops tables.
- Preserve tenant, RBAC, RLS, delegation TTL/refresh, anti-replay and current REST behavior.
- Scope is limited to create campaign draft, update campaign draft and create campaign item draft.

---

### Task 1: Bridge Confirmation Claim

**Files:**
- Modify: `services/chat-bridge/src/marketing-ops-delegation.js`
- Modify: `services/chat-bridge/src/server.js`
- Test: `services/chat-bridge/test/marketing-ops-delegation.test.js`

**Interfaces:**
- Produces: `isExplicitMarketingOpsConfirmation(message: unknown): boolean`
- Produces: delegation claim `confirmation_intent: boolean`

- [x] Write failing tests for exact confirmations, negations, changes and refresh preservation.
- [x] Run `npm test -- --test-name-pattern="confirmation"` in `services/chat-bridge` and verify RED.
- [x] Implement accent-insensitive conservative matching and include the result from `run.message_text` in delegation issuance.
- [x] Preserve `confirmation_intent` during token refresh.
- [x] Run the Bridge suite and verify GREEN.

### Task 2: Stateless Signed Plans

**Files:**
- Create: `services/marketing-ops/src/plans/contracts.ts`
- Create: `services/marketing-ops/src/plans/token.ts`
- Create: `services/marketing-ops/src/plans/executor.ts`
- Create: `services/marketing-ops/src/plans/token.test.ts`
- Create: `services/marketing-ops/src/plans/executor.test.ts`
- Modify: `services/marketing-ops/src/delegation/claims.ts`
- Modify: `services/marketing-ops/src/delegation/verifier.ts`

**Interfaces:**
- Produces: `marketingOpsPlanActionsSchema`
- Produces: `issueMarketingOpsPlan(actor, actions, keyring)`
- Produces: `verifyMarketingOpsPlan(token, actor, keyring)`
- Produces: `executeMarketingOpsPlan(context, plan)`

- [x] Write failing tests proving plan identity binding, expiry, key rotation, same-turn rejection, missing confirmation rejection and tamper rejection.
- [x] Run focused Vitest tests and verify RED.
- [x] Implement plan schemas for campaign create/update and item create, including campaign references for multi-action plans.
- [x] Sign plans with the existing active delegation key and verify active/previous key IDs with a dedicated issuer/audience.
- [x] Derive stable per-action idempotency keys from `plan_id` and action index.
- [x] Execute actions sequentially, resolve campaign references and report completed/failed/pending actions without false success.
- [x] Run focused and domain suites and verify GREEN.

### Task 3: MCP Plan Contract

**Files:**
- Modify: `services/marketing-ops/src/mcp/createServer.ts`
- Modify: `services/marketing-ops/src/mcp.test.ts`
- Modify: `services/marketing-ops/src/production-gate.test.ts`

**Interfaces:**
- Produces MCP tool: `marketing_ops_prepare_plan_v1`
- Produces MCP tool: `marketing_ops_execute_plan_v1`

- [x] Write failing MCP tests for prepare-without-write, same-turn denial, confirmed execution and one confirmation covering campaign plus item.
- [x] Run focused MCP tests and verify RED.
- [x] Register plan tools with descriptions that forbid exposing technical fields to the user.
- [x] Keep low-level v1 tools available for contract compatibility while making the plan tools the only Hermes path.
- [x] Update the production gate to test the conversational plan/confirm lifecycle.
- [x] Run Marketing Ops unit, integration and E2E suites and verify GREEN.

### Task 4: Mandatory Hermes Operator Policy

**Files:**
- Create: `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/SKILL.md`
- Modify: `services/chat-bridge/src/hermes-payloads.js`
- Modify: `services/chat-bridge/test/hermes-payloads.test.js`

**Interfaces:**
- Produces: `NEXUS_MARKETING_OPS_OPERATOR_CONTRACT`

- [x] Use the observed member/course-slug production failure as the skill RED baseline.
- [x] Write a failing payload test requiring the mandatory plan/confirm contract.
- [x] Add the concise skill with natural pt-BR examples and rules for optional course, hidden technical fields, reads, plan changes and errors.
- [x] Inject the compact mandatory contract on every Nexus session turn.
- [x] Run Bridge payload and full suites and verify GREEN.

### Task 5: Hermes Runtime Gate

**Files:**
- Modify: `services/hermes-runtime/vendor/hermes-agent/agent/marketing_ops_delegation.py`
- Modify: `services/hermes-runtime/vendor/hermes-agent/agent/tool_executor.py`
- Modify: `services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py`

**Interfaces:**
- Produces: `marketing_ops_direct_mutation_block_message(function_name)`

- [x] Write failing Python tests that classify all three low-level mutation tools as blocked and leave reads/prepare/execute untouched.
- [x] Run focused pytest and verify RED.
- [x] Apply the gate before dispatch in concurrent, sequential and middleware-wrapped execution paths.
- [x] Return a typed instruction to prepare a plan instead of executing a direct mutation.
- [x] Run Hermes runtime tests and verify GREEN.

### Task 6: Regression, Documentation And Release Evidence

**Files:**
- Modify: `docs/phase-1/design.md`
- Modify: `docs/phase-1/local-validation.md`
- Modify: `docs/phase-1/requirements-traceability.md`
- Modify: `docs/phase-1/runbook.md`
- Modify: `docs/phase-1/vps-validation.md`
- Modify: `docs/prds/phase-1-fundacao-marketing-ops.md`
- Modify: `Roadmap.md`

**Interfaces:**
- Produces: Windows validation evidence and Ubuntu deployment/manual-test steps.

- [x] Run focused Bridge, Marketing Ops and Hermes tests.
- [x] Run the complete equivalent of `scripts/test/phase-1-local.sh` with the established Windows/Docker procedure and temporary Hyper-V-compatible Supabase ports.
- [x] Build and inspect the Linux images for `app-bridge`, `hermes-api` and `marketing-ops`.
- [x] Run `git diff --check`, inspect secrets and verify `.env`/Supabase migrations remain unchanged.
- [x] Record exact test counts and classify this as Phase 1 hardening that does not complete Phases 4 or 5.
- [ ] Commit to `main`, push only after all gates pass, and provide the VPS redeploy and conversational acceptance steps.
