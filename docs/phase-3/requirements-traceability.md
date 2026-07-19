# Rastreabilidade inicial da Fase 3

- **Estado:** `approved_for_execution`
- **Implementação:** 60%
- **Data:** 2026-07-18

| Requisito | Design | Tasks planejadas | Estado |
|---|---|---:|---|
| F3-RF-01 Tipos | 4.1, 5 | 1–2 | `domain_validated` |
| F3-RF-02 Campos | 4.1, 8 | 1–2, 6 | `api_validated` |
| F3-RF-03 Visualizações | 6, 11 | 3, 7–8 | `client_validated` |
| F3-RF-04 Timezone | 7 | 3, 7–8 | `api_validated` |
| F3-RF-05 Reagendamento | 5, 8, 10 | 2–3, 6 | `api_validated` |
| F3-RF-06 Dependências | 4.2, 10 | 4, 6 | `api_validated` |
| F3-RF-07 Conteúdo | 4.3–4.4 | 5–6 | `api_validated` |
| F3-RF-08 Versões | 4.4, 10 | 5–6 | `api_validated` |
| F3-RF-09 Artefatos | 4.5 | 5–6 | `api_validated` |
| F3-RF-10 Estados | 5 | 1–2, 6 | `api_validated` |
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

## Evidência Task 4

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Add/list/remove e bloqueio | `dependencies.test.ts` | domínio validado |
| Self/duplicata/campanha/tenant/terminal | domínio + constraints/FKs/RLS | falha fechada e estável |
| Ciclo indireto | teste A→B→C e trigger recursivo | terceira aresta rejeitada |
| Concorrência/deadlock | `test_item_dependency_concurrency.mjs` | uma aresta aceita; nenhuma ocorrência 40P01 |
| Idempotência/versão | replay, stale remove e versão do item | sem duplicação; rollback íntegro |
| Auditoria/outbox | contagem por ação/evento | um registro por mutação efetiva |
| Reprodutibilidade | reset, 307 pgTAP, lint e diff | todos verdes |

O requisito está validado no domínio, banco e contrato REST/OpenAPI. O aceite
visual e ponta a ponta ainda depende das Tasks 7–8 e do E2E da Task 10.

## Evidência Task 5

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Asset e versões | `content.test.ts` + função atômica | primeira/próxima versão, histórico, hash e freeze verdes |
| Imutabilidade | trigger + pgTAP update/delete | versões append-only inclusive em SQL privilegiado |
| Concorrência/versão | duas escritas no mesmo `expectedVersion` | uma vence e uma retorna conflito |
| Conteúdo legado | backfill + pgTAP de reexecução | corpo preservado, versão congelada, sem duplicação |
| Artifact/ownership | `itemArtifacts.test.ts` + FK composta | owner/tenant/item validados |
| Compensação/unlink | falha injetada + artifact compartilhado | rollback remove upload novo; unlink não apaga bytes |
| Integração real | build Docker + smoke do Artifact Server | upload, metadata, URL assinada, download e cleanup verdes |
| Reprodutibilidade | reset, 320 pgTAP, lint e diff | todos verdes |
| Regressão | serviço, Artifact Server, typecheck e build | 166 + 8 testes verdes |

Os requisitos estão validados no domínio, banco, integração local e contrato
REST/OpenAPI. O aceite visual e ponta a ponta ainda depende das Tasks 7–8 e do
E2E da Task 10.

## Evidência Task 6

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Contrato público | `rest.test.ts` + OpenAPI | 26 paths/38 operações em lockstep |
| Strict/headers/ETag | parsers, inventário e integração REST | mass assignment rejeitado; guards e versões verdes |
| Itens/agenda | fluxo REST real | create/get/list/patch/transition e timezone verdes |
| Dependências | add/list/remove REST | ETags 2/3 e bloqueio derivado verdes |
| Conteúdo/versões | asset/version/stale REST | freeze, asset ETag e 409/currentVersion verdes |
| Artifacts | client fake estrito no router | link/access/unlink e ownership contratual verdes |
| SDK frontend | `client.test.ts` + `queryKeys.test.ts` | 13 testes; auth/correlação/arquivo/query key verdes |
| Payload | 300 KiB e excesso de envelope | aceito dentro do domínio; 413 acima do transporte |
| Regressão | suíte completa + builds | 170 testes, typechecks e builds verdes |
| Docker/manual | build, readiness, login e comandos reais | smoke PASS; healthy antes/depois do reset |

O aceite das visualizações de calendário ainda depende da Task 8; notificações
e lote dependem da Task 9. Esses paths não foram publicados como placeholders.

## Evidência Task 7

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Lista canônica | `ProductionListPage.test.tsx` + browser | mesma query/key; lista e card verdes |
| URL/filtros | `scheduleUrl.test.ts` + smoke | allowlist, enums/UUID e persistência verdes |
| Paginação/estados | teste focado + dados reais | cursor, vazio, sem data, atraso e bloqueio verdes |
| Comandos | diálogo + SDK real | create, patch, reagendamento e transition verdes |
| Concorrência | erro 409/currentVersion | conflito explícito e recarga disponível |
| Autorização/ausência | estados 403/404 | mensagens seguras e correlação |
| Timezone | meta da agenda + formulário | IANA visível; persistência UTC explícita |
| Responsividade | viewport 390×844 | card visível e tabela oculta |
| Regressão | suíte/lint/typecheck/build | 167 testes; zero erro de lint; builds verdes |
| Limpeza | Supabase reset + Docker health | fixture removida; serviço healthy |

A lista acessível está validada localmente. Equivalência semanal/mensal,
limites UTC por view e axe completo permanecem na Task 8.

## Evidência Task 8

| Requisito/gate | Evidência | Resultado |
|---|---|---|
| Fonte canônica | week/month tests + client/query key | mesmos filtros, range e endpoint |
| Limites/fuso | `timezone.test.ts` | São Paulo, ano, mês curto, DST e wall time inválido verdes |
| URL | testes de página + E2E | `date` e filtros preservados na navegação |
| Equivalência | `ProductionCalendar` + lista acessível | mesmos itens; sem truncamento na alternativa |
| Sem data/vazio | componente + E2E | fora da grade; calendário vazio navegável |
| Detalhe/reagendamento | diálogo compartilhado + browser | contexto mantido; local convertido para UTC |
| Overflow | cinco itens no mesmo dia + mobile | `+2` na célula e todos na lista |
| Acessibilidade | Playwright + axe | rows/gridcells, teclado e zero violação A/AA |
| Responsividade | viewport 390×844 | documento sem overflow; scroll interno da grade |
| Regressão | suite/lint/typecheck/build | 174 testes; zero erro de lint; builds verdes |

Lista, semana e mês estão validadas localmente sobre o contrato canônico. A
repetição no ambiente VPS permanece parte do gate final da Task 10.
