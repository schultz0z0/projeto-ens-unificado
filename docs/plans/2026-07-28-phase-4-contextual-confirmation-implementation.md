# Contextual Marketing Ops Confirmation Implementation Plan

- **Status:** Tasks 1–3 concluídas e validadas localmente em 28/07/2026;
  Task 4 depende do deploy e da matriz real na VPS.

**Goal:** Let Hermes interpret a user's response to the pending Marketing Ops
plan as approval, rejection, revision, clarification or no pending decision,
while the Bridge keeps issuing the only signed execution grant.

**Architecture:** The Hermes API gets one authenticated internal endpoint. It
first detects whether its current session has an unexecuted prepared plan; only
then it invokes the configured model with zero tools and a fixed JSON-only
classifier prompt. The Chat Bridge records the enum and signs
`confirmation_intent` only for `approve`; all other results fail closed.

**Tech Stack:** Node.js 20, native `fetch` and `node:test`; Hermes runtime
Python, aiohttp API server and existing `AIAgent` with `enabled_toolsets=[]`.

---

### Task 1: Add the internal, tool-free Hermes decision endpoint

**Files:**

- Modify: `services/hermes-runtime/vendor/hermes-agent/gateway/platforms/api_server.py`
- Modify: `services/hermes-runtime/vendor/hermes-agent/agent/marketing_ops_delegation.py`
- Test: `services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py`

**Step 1: Write the failing tests**

Add a parser test for the only accepted JSON values and a source-level wiring
test proving the endpoint runs with no tools and one model turn:

```python
assert marketing_ops.parse_marketing_ops_confirmation_decision('{"decision":"approve"}') == "approve"
assert marketing_ops.parse_marketing_ops_confirmation_decision('{"decision":"revise"}') == "revise"
assert marketing_ops.parse_marketing_ops_confirmation_decision('approve') == "clarify"
assert marketing_ops.parse_marketing_ops_confirmation_decision('{"decision":"unknown"}') == "clarify"

api = (VENDOR_ROOT / "gateway" / "platforms" / "api_server.py").read_text()
assert '"/v1/internal/marketing-ops-decision"' in api
assert "enabled_toolsets=[]" in api
assert "max_iterations=1" in api
assert "persist_session=False" in api
```

**Step 2: Run the test to verify it fails**

Run:

```powershell
python services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py
```

Expected: FAIL because the parser and internal endpoint do not exist.

**Step 3: Implement the minimum runtime path**

In `marketing_ops_delegation.py`, add a parser that accepts only JSON with
`decision` in `approve`, `reject`, `revise`, `clarify` or `none`; all malformed
responses return `clarify`. Add a helper that scans the session's tool messages
backwards: a latest successful `prepare_plan` is pending; a later
`execute_plan` is not.

In `api_server.py`, add the authenticated route
`POST /v1/internal/marketing-ops-decision`. It must:

1. validate a bounded `session_id` and `message` payload;
2. return `{ "decision": "none" }` without a model call when no plan is
   pending;
3. load at most the recent user/assistant transcript for the session, never
   raw tool results or delegation blocks;
4. call `AIAgent` once with `enabled_toolsets=[]`, no session persistence and
   a fixed prompt that returns JSON only;
5. return only the parsed enum. Timeout, exception and malformed output return
   `clarify` with a non-sensitive reason code.

The fixed prompt treats transcript text as data, permits `approve` only for an
unqualified affirmative about the pending plan, and classifies questions,
negation, qualifiers, changes and deferrals as non-approval.

**Step 4: Run the test to verify it passes**

Run:

```powershell
python services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add services/hermes-runtime/vendor/hermes-agent services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py
git commit -m "feat(hermes): classify pending plan responses"
```

### Task 2: Bind the Bridge delegation to the semantic decision

**Files:**

- Modify: `services/chat-bridge/src/server.js`
- Modify: `services/chat-bridge/src/marketing-ops-delegation.js`
- Test: `services/chat-bridge/test/marketing-ops-delegation.test.js`
- Test: `services/chat-bridge/test/server-runtime-scope.test.js`

**Step 1: Write the failing tests**

Replace phrase-list expectations with decisions supplied by the internal
endpoint. Cover the business matrix:

```js
assert.equal(confirmationIntentForMarketingOpsDecision("approve"), true);
assert.equal(confirmationIntentForMarketingOpsDecision("reject"), false);
assert.equal(confirmationIntentForMarketingOpsDecision("revise"), false);
assert.equal(confirmationIntentForMarketingOpsDecision("clarify"), false);
assert.equal(confirmationIntentForMarketingOpsDecision("none"), false);
```

Mock the internal Hermes response and assert that a run records only the enum,
passes `confirmation_intent=true` for `approve`, and passes `false` when the
endpoint fails or returns invalid JSON. Assert no message text or token appears
in its event payload.

**Step 2: Run the tests to verify they fail**

Run:

```powershell
Set-Location services/chat-bridge
node --test test/marketing-ops-delegation.test.js test/server-runtime-scope.test.js
```

Expected: FAIL because the Bridge still reads the message with phrase regexes.

**Step 3: Implement the minimum Bridge path**

Delete `explicitConfirmationPhrases` and all regex-based approval detection.
Keep the delegation signer unchanged except for a small
`confirmationIntentForMarketingOpsDecision(decision)` helper, which returns true only for
the exact `approve` enum.

After `ensureHermesSessionBinding` and before either Hermes execution mode,
call the internal endpoint with the current Hermes session ID and user message.
Use the existing Hermes base URL, API key and `AbortSignal.timeout`; do not add
configuration unless the existing Bridge timeout cannot be reused. Store the
enum on the transient run and append a correlation-only event. If any request
or parse failure occurs, use `clarify`.

`issueRunMarketingOpsDelegation` must derive `confirmationIntent` exclusively
from the stored enum. Picture mode skips this call entirely.

**Step 4: Run the focused tests to verify they pass**

Run:

```powershell
Set-Location services/chat-bridge
node --test test/marketing-ops-delegation.test.js test/server-runtime-scope.test.js
npm test
```

Expected: focused tests and the complete Bridge suite PASS.

**Step 5: Commit**

```powershell
git add services/chat-bridge/src services/chat-bridge/test
git commit -m "fix(bridge): sign contextual plan approvals"
```

### Task 3: Align the operator contract, phase traceability and validation

**Files:**

- Modify: `services/chat-bridge/src/hermes-payloads.js`
- Modify: `services/chat-bridge/test/hermes-payloads.test.js`
- Modify: `docs/phase-4/{README,implementation-progress,local-validation,requirements-traceability,runbook,vps-validation,continuation-handoff}.md`
- Test: `services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py`

**Step 1: Write the failing contract tests**

Require the operator prompt to distinguish `approve`, `reject`, `revise` and
`clarify`, and to never execute on a question, qualifier or requested change.

**Step 2: Run the tests to verify they fail**

Run:

```powershell
Set-Location services/chat-bridge
node --test test/hermes-payloads.test.js
```

Expected: FAIL because the contract only describes a generic explicit phrase.

**Step 3: Make the smallest contract and documentation changes**

Tell the operator that conversational intent is evaluated against the pending
plan and that it must follow the returned permission: execute only the exact
plan on approval; otherwise reject, clarify or prepare a revised plan. Do not
expose enum names, internal endpoint details, tokens or raw errors to users.

Record the root cause, the fail-closed behavior, local test results, VPS
redeploy command for both `hermes-api` and `app-bridge`, and the real manual
matrix: approve with `vamos nessa`/`pode ser`, reject, revise, question,
classifier failure and successful deep link. Keep Phase 4 as pending until the
production matrix has passed.

**Step 4: Run all local gates**

Run:

```powershell
Set-Location services/chat-bridge
npm test
Set-Location ../hermes-runtime
python docker/tests/test_marketing_ops_delegation_runtime.py
git diff --check
```

Expected: all tests PASS and no whitespace errors.

**Step 5: Commit**

```powershell
git add services/chat-bridge/src/hermes-payloads.js services/chat-bridge/test/hermes-payloads.test.js services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py docs/phase-4 docs/plans/2026-07-28-phase-4-contextual-confirmation-implementation.md docs/plans/2026-07-28-phase-4-contextual-confirmation-design.md
git commit -m "docs(phase-4): trace contextual confirmation validation"
```

### Task 4: VPS deployment and real acceptance test

**Files:**

- Execute: `docs/phase-4/runbook.md`
- Update: `docs/phase-4/vps-validation.md`

**Step 1: Build and recreate the two affected services**

Run on the VPS:

```bash
set -euo pipefail
cd /opt/nexus-ens
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
```

Expected: both services healthy; no secret is printed.

**Step 2: Execute the real matrix**

In new chats, create disposable drafts and test each outcome. Confirm in Hermes
logs that only `approve` leads to `execute_plan`, that `revise` creates a new
preview, and that `reject`/`clarify` do not persist data.

**Step 3: Record evidence and commit**

Update `vps-validation.md` with timestamps, non-sensitive correlation data,
observed tool sequence and deep-link result. Mark the Phase 4 gate complete
only after every case passes.
