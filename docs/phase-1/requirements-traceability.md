# Rastreabilidade da Fase 1

- **Estado:** `ready_for_production`
- **Data da revisão:** 2026-07-13
- **Escopo:** Supabase do app, Marketing Ops, Bridge, Hermes, frontend e Compose
- **Exclusão confirmada:** nenhuma migration ou operação no Supabase do RAG

## Requisitos do PRD

| Requisito | Implementação principal | Evidência automatizada | Estado |
|---|---|---|---|
| F1-RF-01 Serviço independente | `services/marketing-ops`, Dockerfile e Compose | foundation tests, build Linux, health/readiness | `validated_locally` |
| F1-RF-02 API autenticada | `auth/*`, middleware REST e transação com ator | auth/rest/E2E e pgTAP cross-tenant | `validated_locally` |
| F1-RF-03 Interface MCP | MCP Streamable HTTP e tools `*_v1` | MCP contract tests e E2E com cliente oficial | `validated_locally` |
| F1-RF-04 Delegação Hermes | emissor/renovador Bridge, transporte efêmero, binding no executor, redaction no SessionDB e verificador Marketing Ops | Bridge 66, Hermes 10 e MCP replay/scope/TTL/refresh | `validated_locally` |
| F1-RF-05 Modelo transacional | schemas `marketing_ops` e `marketing_ops_private` | reset limpo e 97 testes pgTAP | `validated_locally` |
| F1-RF-06 Tenant | memberships confiáveis, RLS e contexto transacional | testes de tenant forjado e segundo tenant | `validated_locally` |
| F1-RF-07 Papéis | matriz member/manager/admin | testes positivos e negativos de RBAC/RLS | `validated_locally` |
| F1-RF-08 RLS | policies/grants explícitos e force RLS | pgTAP, lint e advisors sem erros | `validated_locally` |
| F1-RF-09 Auditoria | `audit_events` append-only na transação | imutabilidade pgTAP e rollback injetado | `validated_locally` |
| F1-RF-10 Idempotência | hash canônico e `idempotency_records` | replay igual e conflito divergente | `validated_locally` |
| F1-RF-11 Concorrência | version/ETag e `If-Match` | update v2 e stale 409 | `validated_locally` |
| F1-RF-12 Eventos | outbox `domain_events` atômico | domínio e falha injetada sem órfão | `validated_locally` |
| F1-RF-13 Erros | `AppError`, envelopes REST e resultados MCP | foundation/rest/MCP tests | `validated_locally` |
| F1-RF-14 Capacidades | endpoints/tools com contrato e flags | capabilities e kill-switch tests | `validated_locally` |

## Backlog P0

| Item | Evidência de fechamento | Estado |
|---|---|---|
| F1-001 | desenvolvimento local identificado; produção nunca usada por testes | `validated_locally` |
| F1-002 | baseline reproduzível e histórico remoto documentado | `validated_locally` |
| F1-003 | backups externos, legado em quarentena e cadeia oficial adotada sem RAG | `deployed_and_validated` |
| F1-004 | Bridge ignora `user_metadata` e produção falha fechada | `validated_locally` |
| F1-005 | serviço, config, probes, shutdown e Compose | `validated_locally` |
| F1-006 | tenants/memberships e bootstrap de perfis ENS | `validated_locally` |
| F1-007 | delegação assinada, curta, com scopes, replay, rotação e sem persistência no SessionDB | `validated_locally` |
| F1-008 | schema de campaigns/items/audit/idempotency/outbox | `validated_locally` |
| F1-009 | RLS default-deny, grants e testes cross-tenant | `validated_locally` |
| F1-010 | OpenAPI v1, CORS, rate limit, filtros e cursor | `validated_locally` |
| F1-011 | tools MCP v1 sobre o mesmo domínio | `validated_locally` |
| F1-012 | writes atômicos e idempotentes | `validated_locally` |
| F1-013 | logs redigidos e métricas de request/latência/erro/outbox | `validated_locally` |
| F1-014 | gate único, backup, rollback e checklist VPS | `validation_in_progress` |

## Backlog P1

| Item | Evidência de fechamento | Estado |
|---|---|---|
| F1-101 | SDK tipado, token fresco, erro/correlation ID, filtros e cursor | `validated_locally` |
| F1-102 | flags default-off e kill switch | `validated_locally` |
| F1-103 | version/ETag/If-Match | `validated_locally` |
| F1-104 | curso/status/owner/período, cursor e índices | `validated_locally` |
| F1-105 | deep links armazenam somente tipo e UUID | `validated_locally` |
| F1-106 | matriz de retenção e procedimento LGPD | `documented` |
| F1-107 | audit frontend sem vulnerabilidades conhecidas | `validated_locally` |
| F1-108 | runbook, rollback e SLO | `documented` |

## Evidências agregadas

- [Validação local](local-validation.md)
- [Baseline Supabase](supabase-baseline.md)
- [Deploy Supabase](supabase-deployment.md)
- [Design técnico](design.md)
- [Runbook](runbook.md)
- [Rollback](rollback.md)
- [Riscos](risk-register.md)
- [Validação VPS](vps-validation.md)

O único gate aberto da Fase 1 é redeployar o hardening e concluir os testes manuais 15–20 na VPS Ubuntu. Os equivalentes 15–20 passaram por MCP contra o Supabase local real, mas o teste 15 de produção anterior revelou tokens legados em `messages.tool_calls`, canal que a consulta antiga de `content` não cobria. Até a nova evidência VPS, o estado geral não deve avançar para `production_validated` ou `completed`.
