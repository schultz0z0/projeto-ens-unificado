# Rastreabilidade de requisitos — Fase 5

- **Estado:** `seeded`
- **Revisão:** 2026-08-05
- **Implementação:** não iniciada

## Matriz requisito → design → task

| Requisito | Design | Task | Estado |
|---|---:|---:|---|
| F5-RF-01 Solicitação editorial | 5.2, 5.5, 8 | 1–2 | `planned` |
| F5-RF-02 Solicitação operacional | 5.4, 8 | 1, 3 | `planned` |
| F5-RF-03 Fila | 9, 11 | 2, 4–5 | `planned` |
| F5-RF-04 Decisão | 5.3, 6, 8 | 2–5 | `planned` |
| F5-RF-05 Segregação | 7 | 1, 3, 8 | `planned` |
| F5-RF-06 Expiração | 6, 8 | 3, 6 | `planned` |
| F5-RF-07 Alteração | 5.5, 6 | 2–3, 6 | `planned` |
| F5-RF-08 Ajustes | 5.2–5.3, 6 | 2, 5–6 | `planned` |
| F5-RF-09 Action package | 5.4–5.5 | 1, 3 | `planned` |
| F5-RF-10 Notificações | 12 | 6 | `planned` |
| F5-RF-11 Hermes | 10 | 7 | `planned` |
| F5-RF-12 Histórico | 5.3, 11 | 2, 4–5 | `planned` |

## Gates transversais

| Gate | Design | Task | Estado |
|---|---:|---:|---|
| RLS/RBAC/cross-tenant | 7, 13 | 1, 8 | `planned` |
| Imutabilidade/hash | 5.4–5.5 | 1, 3, 8 | `planned` |
| Idempotência/concorrência | 8 | 2–4, 8 | `planned` |
| Auditoria/outbox | 8, 12 | 2–3, 6 | `planned` |
| Acessibilidade/responsividade | 11, 15 | 5, 8–9 | `planned` |
| Observabilidade/redaction | 13–14 | 6, 8–9 | `planned` |
| Hermes sem decisão | 10, 13 | 7–9 | `planned` |
| Migration/rollback | 16 | 1, 8–9 | `planned` |
| Gate local | 17 | 8 | `planned` |
| Gate VPS/navegador | 17 | 9 | `planned` |

## Critério de fechamento

A matriz muda para `closed` somente quando cada requisito possui código,
teste/evidência, referência no progresso e nenhuma divergência conhecida entre
PRD, design, OpenAPI, MCP, frontend e comportamento real.
