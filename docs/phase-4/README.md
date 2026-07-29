# Fase 4 — Hermes Campaign Operator

Este diretório reúne o contrato, a implementação executada e a preparação
operacional da Fase 4 no padrão documental das Fases 0–3. O código local, a
evidência de teste aplicável e o schema remoto do Supabase foram reconciliados.
A homologação real está no último gate. Com GPT-5.6 Terra, campanha, item,
conteúdo inicial, timeline, agenda, confirmação contextual, RAG, Graph, RBAC,
prompt injection, deep links, auditoria e idempotência passaram no app, logs e
Supabase. O reteste de revisão após o pacote `1.2.2` leu o corpo corretamente,
mas revelou seleção aproximada de identidade: o agente confundiu dois assets e
criou a versão no conteúdo errado. O pacote local `1.2.3` corrige a resolução
exata e o preview identificável; falta seu deploy e o reteste final.

## Status

- **Fase:** `implemented_pending_vps_validation`
- **Snapshot reconciliado:** 2026-07-29
- **Tasks:** 1–8 concluídas no escopo local/documental
- **Homologação VPS:** `blocked_wrong_target_pending_skill_1_2_3_retest`
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
| Homologação VPS | `blocked_wrong_target_pending_skill_1_2_3_retest` | [checklist](vps-validation.md) |
| Handoff | `pending_skill_1_2_3_redeploy_then_exact_target_revision` | [continuation-handoff.md](continuation-handoff.md) |

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
  delegação validados (87/87 testes locais);
- `chat-web`: typecheck, build, 22 testes dirigidos de deep link/chat e E2E fake
  do operador Hermes aprovados;
- runtime Hermes: decisão contextual isolada, respostas curtas inequívocas
  resolvidas sem modelo, contrato de saída fechado, delegação/scrub/RAG-Graph
  e instalação canônica da skill estruturada validados localmente (19 testes
  passaram; 1 teste POSIX ficou indisponível no Windows);
- migration remota
  `20260722130000_phase_4_hermes_operator_audit.sql` aplicada no Supabase
  conectado, com os sete campos novos confirmados em
  `marketing_ops.audit_events`;
- histórico local/remoto da migration alinhado pela Supabase CLI em 2026-07-28,
  sem reaplicar DDL ou alterar dados de domínio;
- smoke real de leitura concluído no app publicado: campanhas e agenda foram
  obtidas por Hermes/MCP/Marketing Ops sem mutação; o log revelou duas
  tentativas inválidas de intervalo antes da correção do contrato de agenda;
- preview real anterior concluído sem persistência; o pós-deploy do décimo release
  provou o novo timeout, mas expôs colisão de skill e classificação
  não determinística de `vamos nessa`, corrigidas no décimo primeiro release;
- matriz real com GPT-5.6 Terra comprovou campanha, atualização, confirmação
  contextual, revisão, rejeição, idempotência e item da esteira vinculado;
- asset + versão inicial, timeline, agenda, auditoria e deep link passaram no
  pacote `1.2.1`;
- RAG, Graph, RBAC por três papéis e prompt injection passaram; o pacote
  `1.2.2` corrigiu a leitura do histórico, porém o reteste revelou uma mutação
  no asset errado por correspondência aproximada;
- o incidente real foi reconciliado com logs, diagnóstico do Hermes e Supabase:
  o asset solicitado permaneceu na versão 1 e o asset `Email inicial` recebeu
  indevidamente a versão 2; a auditoria aponta uma única execução correlacionada;
- a regressão RED→GREEN do pacote `1.2.3` exige rótulo humano exato, falha
  fechada quando o alvo não é resolvido e preview explícito de
  campanha/item/conteúdo;
- limitação ambiental local explicitada: Docker/PostgreSQL não estão
  disponíveis nesta máquina, então pgTAP/reset/lint de banco e homologação VPS
  real continuam fora deste snapshot.

## Resíduos conhecidos

- conflito controlado, rate limit e restart continuam cobertos por testes
  automatizados e não serão provocados no site público sem janela operacional;
- a promoção para `production_validated` não pode ocorrer apenas com o E2E fake
  e a migration remota, porque a jornada completa ainda precisa ser repetida na
  infraestrutura final.
- o pacote `1.2.3` ainda precisa ser publicado no `hermes-api`;
- a revisão ENS deve ser repetida com campanha, item e conteúdo explícitos,
  validando zero escrita antes da confirmação, versão 2 no asset correto e
  ausência de nova escrita no asset incorreto.

## Decisão

**A Fase 4 continua implementada, mas não está promovida: o reteste real
encontrou seleção de alvo incorreta antes do fechamento.** A promoção para
`production_validated` depende do deploy pontual da skill `1.2.3`, do reteste
da revisão no asset exato e da reconciliação final conforme
[vps-validation.md](vps-validation.md).
