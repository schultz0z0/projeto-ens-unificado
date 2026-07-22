# Fase 4 — Hermes Campaign Operator

Este diretório reúne o contrato, a implementação executada e a preparação
operacional da Fase 4 no padrão documental das Fases 0–3. O código local, a
evidência de teste aplicável e o schema remoto do Supabase foram reconciliados;
falta apenas o gate real de homologação na VPS para promover a fase.

## Status

- **Fase:** `implemented_pending_vps_validation`
- **Snapshot reconciliado:** 2026-07-22
- **Tasks:** 1–8 concluídas no escopo local/documental
- **Homologação VPS:** `pending_user_execution`
- **Supabase remoto:** `migration_applied_remote`
- **Branch única:** `main`
- **Dependência:** Fase 3 `production_validated`
- **PRD:** [phase-4-hermes-campaign-operator.md](../prds/phase-4-hermes-campaign-operator.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-20-phase-4-hermes-campaign-operator-implementation.md](../plans/2026-07-20-phase-4-hermes-campaign-operator-implementation.md)

## Pacote documental

| Entregável/gate | Estado | Evidência |
|---|---|---|
| PRD/design/plano | `approved_as_built` | PRD, design e plano reconciliados com a implementação |
| Tasks 1–8 | `completed_pending_vps_gate` | [progresso](implementation-progress.md) |
| Rastreabilidade F4-RF-01–12 | `reconciled_pending_vps_gate` | [rastreabilidade](requirements-traceability.md) |
| Registro de riscos | `reconciled_with_residuals` | [risk-register.md](risk-register.md) |
| Supabase remoto | `migration_applied_remote` | [deploy](supabase-deployment.md) |
| Gate local | `partially_executed` | [local-validation.md](local-validation.md) |
| Operação/rollback | `ready_for_execution` | [runbook](runbook.md), [rollback](rollback.md) |
| Homologação VPS | `ready_for_execution` | [checklist](vps-validation.md) |
| Handoff | `ready_for_continuation_or_deploy` | [continuation-handoff.md](continuation-handoff.md) |

## Escopo entregue

- leituras MCP para campanhas, agenda, timeline, conteúdo e capacidades por
  objeto sobre o domínio existente do `marketing-ops`;
- ampliação segura de `prepare_plan_v1` e `execute_plan_v1` para campanhas,
  itens, conteúdo, artefatos e notas;
- contrato do operador Hermes endurecido para leituras sem confirmação e
  mutações somente por plano assinado e confirmação em turno posterior;
- resultados estruturados com `completed[]`, `failed[]`, `pending[]`, erros
  seguros e `deep_links[]` compatíveis com o frontend;
- correlação ponta a ponta de chat/run/tool/plano/ação na auditoria;
- jornada E2E local controlada cobrindo confirmação antes da execução, deep link
  real no frontend e indisponibilidade sem falso sucesso.

## Evidência consolidada

- `marketing-ops`: typecheck, build, contratos MCP, executor, auditoria,
  métricas e migration estática verdes;
- `chat-bridge`: contrato do operador Hermes e guardrails de delegação validados;
- `chat-web`: typecheck, build, testes dirigidos de deep link/chat e E2E fake
  do operador Hermes aprovados;
- migration remota
  `20260722130000_phase_4_hermes_operator_audit.sql` aplicada no Supabase
  conectado, com os sete campos novos confirmados em
  `marketing_ops.audit_events`;
- limitação ambiental local explicitada: Docker/PostgreSQL não estão
  disponíveis nesta máquina, então pgTAP/reset/lint de banco e homologação VPS
  real continuam fora deste snapshot.

## Resíduos conhecidos

- conflitos, retry idempotente, forged tenant/role, prompt injection, RAG/Graph
  e restart/persistência ainda dependem de banco/serviços reais no gate VPS;
- a promoção para `production_validated` não pode ocorrer apenas com o E2E fake
  e a migration remota, porque a jornada completa ainda precisa ser repetida na
  infraestrutura final.

## Decisão

**A Fase 4 está implementada e documentada, pronta para homologação na VPS.** A
promoção para `production_validated` depende apenas do deploy real, dos smokes
manuais e do aceite final do usuário conforme [vps-validation.md](vps-validation.md).
