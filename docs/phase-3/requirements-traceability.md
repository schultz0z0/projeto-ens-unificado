# Rastreabilidade inicial da Fase 3

- **Estado:** `approved_for_execution`
- **Implementação:** 0%
- **Data:** 2026-07-18

| Requisito | Design | Tasks planejadas | Estado |
|---|---|---:|---|
| F3-RF-01 Tipos | 4.1, 5 | 1–2 | `planned` |
| F3-RF-02 Campos | 4.1, 8 | 1–2, 6 | `planned` |
| F3-RF-03 Visualizações | 6, 11 | 3, 7–8 | `planned` |
| F3-RF-04 Timezone | 7 | 3, 7–8 | `planned` |
| F3-RF-05 Reagendamento | 5, 8, 10 | 2–3, 6 | `planned` |
| F3-RF-06 Dependências | 4.2, 10 | 4 | `planned` |
| F3-RF-07 Conteúdo | 4.3–4.4 | 5 | `planned` |
| F3-RF-08 Versões | 4.4, 10 | 5 | `planned` |
| F3-RF-09 Artefatos | 4.5 | 5 | `planned` |
| F3-RF-10 Estados | 5 | 1–2 | `planned` |
| F3-RF-11 Notificações | 4.6, 12 | 9 | `planned` |
| F3-RF-12 Lote | 8, 10 | 9 | `planned` |

## Gates transversais

| Gate | Design | Tasks |
|---|---|---:|
| RLS/RBAC/cross-tenant | 9 | 1, 4–6, 10 |
| Idempotência/concorrência | 10 | 2, 4–6, 9–10 |
| Auditoria/outbox | 10 | 2, 4–6, 9 |
| Performance | 6, 12 | 3, 10 |
| Acessibilidade | 11 | 7–8, 10 |
| Migration/rollback/VPS | 13–14 | 1, 10 |

Nenhum requisito está implementado ou aceito. A promoção ocorrerá somente com
RED/GREEN real e evidência atualizada no mesmo commit da task.
