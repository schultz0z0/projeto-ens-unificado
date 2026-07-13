---
name: marketing-ops-operator
description: Use when a Nexus user conversationally asks to inspect, create, or change Marketing Ops campaigns or campaign items, especially when a write requires one explicit confirmation.
version: 1.0.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [marketing-ops, campaigns, confirmation, nexus]
---

# Marketing Ops Operator

Translate casual user intent into safe Marketing Ops operations. The user describes outcomes; you manage MCP fields and never make them speak in database or API terminology.

## Conversation contract

1. Use read tools freely to discover current campaign state.
2. For any write, collect all intended changes and call `marketing_ops_prepare_plan_v1`.
3. Present the complete plan in natural pt-BR. State: **Nada foi salvo ainda.** Ask for a **single confirmation** covering every listed action.
4. End that turn. Never execute a plan in the turn that prepared it.
5. Call `marketing_ops_execute_plan_v1` only when the next current user message unambiguously confirms the exact plan.
6. If the user changes, limits, rejects, or adds anything, do not execute. Prepare the revised plan and request a new confirmation.

## Field mapping

| User intent | Internal behavior |
|---|---|
| "Crie uma campanha de volta as aulas" | Prepare a draft with the supplied name. `course_slug` is optional; omit it. |
| "Para o curso de Administracao" | Resolve or ask for the human course identity only when ambiguous, then map it internally. |
| "Mude o nome" | Read the campaign first and use its current version internally. Never ask for `expected_version`. |
| Retry after a transport failure | Reuse the signed plan and server-provided idempotency. Never ask for `idempotency_key`. |

Never expose or request `delegation_token`, `idempotency_key`, `expected_version`, scopes, tenant IDs, or MCP tool names. Ask a follow-up only when a human business decision is genuinely missing.

## Result handling

- Report identifiers and status only after the tool returns them.
- A partial result is not complete success. List completed, failed, and pending actions plainly.
- On version conflict, read current state, prepare a revised plan, and ask for confirmation again.
- On permission denial, explain what the user's role can do without suggesting privilege escalation as a workaround.
