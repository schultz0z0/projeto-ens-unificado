# Fase 4 — Hermes Campaign Operator

Este diretório reúne o contrato, a implementação executada e a preparação
operacional da Fase 4 no padrão documental das Fases 0–3. O código local, a
evidência de teste aplicável e o schema remoto do Supabase foram reconciliados.
A homologação real está em curso: a leitura de produção passou. O próximo
release candidato corrige a compatibilidade de serialização de ações do
provedor, torna o contrato de agenda explícito e publica a skill estruturada
no `hermes-api`; depois dele começam as jornadas reais de escrita.

## Status

- **Fase:** `implemented_pending_vps_validation`
- **Snapshot reconciliado:** 2026-07-28
- **Tasks:** 1–8 concluídas no escopo local/documental
- **Homologação VPS:** `in_progress_pending_ninth_release_candidate_deploy`
- **Supabase remoto:** `migration_history_aligned_remote`
- **Branch única:** `main`
- **Dependência:** Fase 3 `production_validated`
- **PRD:** [phase-4-hermes-campaign-operator.md](../prds/phase-4-hermes-campaign-operator.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-20-phase-4-hermes-campaign-operator-implementation.md](../plans/2026-07-20-phase-4-hermes-campaign-operator-implementation.md)
- **Fechamento do gate:** [2026-07-28-phase-4-release-gate.md](../plans/2026-07-28-phase-4-release-gate.md)
- **Decisão contextual:** [design aprovado](../plans/2026-07-28-phase-4-contextual-confirmation-design.md) · [plano executado](../plans/2026-07-28-phase-4-contextual-confirmation-implementation.md)

## Pacote documental

| Entregável/gate | Estado | Evidência |
|---|---|---|
| PRD/design/plano | `approved_as_built` | PRD, design e plano reconciliados com a implementação |
| Tasks 1–8 | `completed_pending_vps_gate` | [progresso](implementation-progress.md) |
| Rastreabilidade F4-RF-01–12 | `reconciled_pending_vps_gate` | [rastreabilidade](requirements-traceability.md) |
| Registro de riscos | `reconciled_with_residuals` | [risk-register.md](risk-register.md) |
| Supabase remoto | `migration_history_aligned_remote` | [deploy](supabase-deployment.md) |
| Gate local | `partially_executed` | [local-validation.md](local-validation.md) |
| Operação/rollback | `ready_for_execution` | [runbook](runbook.md), [rollback](rollback.md) |
| Homologação VPS | `read_smoke_validated_ninth_release_candidate_deploy_pending` | [checklist](vps-validation.md) |
| Handoff | `pending_marketing_ops_app_bridge_hermes_api_redeploy` | [continuation-handoff.md](continuation-handoff.md) |

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

- `marketing-ops`: typecheck, build e normalização compatível de ações MCP
  verdes; payload direto, envelope `item` e string JSON seguem para a mesma
  validação estrita;
- `chat-bridge`: contrato contextual do operador Hermes e guardrails de
  delegação validados (86/86 testes locais);
- `chat-web`: typecheck, build, 22 testes dirigidos de deep link/chat e E2E fake
  do operador Hermes aprovados;
- runtime Hermes: decisão contextual isolada, contrato de saída fechado,
  delegação/scrub/RAG-Graph, skill estruturada e `compileall` validados
  localmente;
- migration remota
  `20260722130000_phase_4_hermes_operator_audit.sql` aplicada no Supabase
  conectado, com os sete campos novos confirmados em
  `marketing_ops.audit_events`;
- histórico local/remoto da migration alinhado pela Supabase CLI em 2026-07-28,
  sem reaplicar DDL ou alterar dados de domínio;
- smoke real de leitura concluído no app publicado: campanhas e agenda foram
  obtidas por Hermes/MCP/Marketing Ops sem mutação; o log revelou duas
  tentativas inválidas de intervalo antes da correção do contrato de agenda;
- limitação ambiental local explicitada: Docker/PostgreSQL não estão
  disponíveis nesta máquina, então pgTAP/reset/lint de banco e homologação VPS
  real continuam fora deste snapshot.

## Resíduos conhecidos

- conflitos, retry idempotente, forged tenant/role, prompt injection, RAG/Graph
  e restart/persistência ainda dependem de banco/serviços reais no gate VPS;
- a promoção para `production_validated` não pode ocorrer apenas com o E2E fake
  e a migration remota, porque a jornada completa ainda precisa ser repetida na
  infraestrutura final.
- o preview real ainda precisa ser repetido depois do nono release candidato:
  o provedor também pode serializar a action única como objeto tipado direto
  ou string JSON. A compatibilidade foi adicionada antes da mesma validação
  estrita, sem expandir campos, autorização ou confirmação.

## Decisão

**A Fase 4 está implementada e documentada; sua homologação real está em
andamento.** A promoção para `production_validated` depende do deploy pontual
de `marketing-ops`, `app-bridge` e `hermes-api`, dos smokes de escrita executados pelo assistente
no ambiente publicado e do aceite final do usuário conforme
[vps-validation.md](vps-validation.md).
