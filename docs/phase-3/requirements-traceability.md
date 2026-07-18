# Rastreabilidade inicial da Fase 3

- **Estado:** `approved_for_execution`
- **Implementação:** 30%
- **Data:** 2026-07-18

| Requisito | Design | Tasks planejadas | Estado |
|---|---|---:|---|
| F3-RF-01 Tipos | 4.1, 5 | 1–2 | `domain_validated` |
| F3-RF-02 Campos | 4.1, 8 | 1–2, 6 | `domain_validated` |
| F3-RF-03 Visualizações | 6, 11 | 3, 7–8 | `query_validated` |
| F3-RF-04 Timezone | 7 | 3, 7–8 | `backend_validated` |
| F3-RF-05 Reagendamento | 5, 8, 10 | 2–3, 6 | `domain_validated` |
| F3-RF-06 Dependências | 4.2, 10 | 4 | `planned` |
| F3-RF-07 Conteúdo | 4.3–4.4 | 5 | `planned` |
| F3-RF-08 Versões | 4.4, 10 | 5 | `planned` |
| F3-RF-09 Artefatos | 4.5 | 5 | `planned` |
| F3-RF-10 Estados | 5 | 1–2 | `domain_validated` |
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

## Evidência Task 1

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Tipos fechados e estados reservados | `contracts.test.ts` + `marketing_ops_calendar.test.sql` | 19 contratos e 37 pgTAP verdes |
| Campos, constraints e índices | migration + pgTAP de schema | validado localmente |
| RLS/grants/helpers | 30 novos pgTAP + 98 cenários RLS legados | validado localmente |
| Reprodutibilidade | `db reset`, `db lint`, `db diff` | reset verde, lint vazio, diff vazio |
| Regressão de serviço | `npm test`, `typecheck`, `build` | 135 pass, 2 skips condicionais |

Nenhum requisito foi promovido a `accepted`: Tasks 1–2 validam fundação,
contratos e domínio. O aceite público depende das APIs, UI e E2E das Tasks
3–10.

## Evidência Task 2

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| CRUD e campos | `domain/items.test.ts` | create/get/patch e normalização verdes |
| Estados e terminalidade | `domain/items.test.ts` + contrato | todos os edges aprovados e terminais validados |
| Versão/idempotência | replay, stale write e contagem audit/outbox | validado localmente |
| RBAC/cross-tenant | campanha arquivada, assignee externo e leitura externa | 409/422/404 estáveis |
| Auditoria minimizada | audit JSON não contém descrição/metadata brutas | validado localmente |
| Regressão | suíte de serviço + typecheck + build | 142 pass, 2 skips condicionais |

O status `domain_validated` não equivale a aceite público: REST/OpenAPI, UI e
E2E ainda dependem das Tasks 6–10.

## Evidência Task 3

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Query canônica e filtros | `scheduling.test.ts` + `queries.test.ts` | range, filtros, cursores e itens sem data verdes |
| Timezone | config, Compose e testes IANA/DST | backend validado com fallback São Paulo |
| Cross-tenant | cenário com ator do segundo tenant + pgTAP de função | nenhuma linha externa; grants/search path validados |
| Performance | harness de 10.000 itens + EXPLAIN | p95 40,02 ms; função 18,68 ms |
| Reprodutibilidade | pgTAP, lint e diff | 299 testes, lint vazio e diff vazio |
| Regressão | suíte de serviço + typecheck + build | 153 pass, 2 skips condicionais |

As visualizações ainda não estão aceitas: a fonte canônica está validada, mas
lista/semana/mês e acessibilidade pertencem às Tasks 7–8.
