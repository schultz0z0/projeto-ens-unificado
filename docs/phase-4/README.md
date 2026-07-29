# Fase 4 — Hermes Campaign Operator

Este diretório reúne o contrato, a implementação executada e a operação
validada da Fase 4 no padrão documental das Fases 0–3. Código, testes
aplicáveis, schema remoto do Supabase e jornada real na VPS foram
reconciliados. Com GPT-5.6 Terra, campanha, item, conteúdo inicial e revisado,
timeline, agenda, confirmação contextual, RAG, Graph, RBAC, prompt injection,
deep links, auditoria e idempotência passaram no app, logs e Supabase. O pacote
`1.2.3` comprovou resolução exata e falha fechada; o pacote `1.2.4` fechou o
último gate ao renderizar e navegar por um deep link Markdown real. Não há
bloqueador conhecido dentro do escopo da Fase 4.

## Status

- **Fase:** `production_validated`
- **Snapshot reconciliado:** 2026-07-29
- **Tasks:** 1–8 concluídas e homologadas no escopo aplicável
- **Homologação VPS:** `production_validated`
- **Supabase remoto:** `migration_history_aligned_remote_production_trace_validated`
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
| Tasks 1–8 | `completed_production_validated` | [progresso](implementation-progress.md) |
| Rastreabilidade F4-RF-01–12 | `closed` | [rastreabilidade](requirements-traceability.md) |
| Registro de riscos | `closed_with_accepted_residuals` | [risk-register.md](risk-register.md) |
| Supabase remoto | `migration_history_aligned_remote_production_trace_validated` | [deploy](supabase-deployment.md) |
| Gate local | `completed_with_documented_environment_limits` | [local-validation.md](local-validation.md) |
| Operação/rollback | `runbook_executed_rollback_documented_not_drilled` | [runbook](runbook.md), [rollback](rollback.md) |
| Homologação VPS | `production_validated` | [checklist](vps-validation.md) |
| Handoff | `phase_4_closed` | [continuation-handoff.md](continuation-handoff.md) |

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
  e instalação canônica da skill estruturada validados localmente (20 testes
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
- o reteste `1.2.3` passou: versão 2 no asset correto, asset-evidência sem nova
  versão, corpo/hash/auditoria correlacionados e cenário inexistente com zero
  plano/auditoria/persistência;
- o pacote `1.2.4` foi carregado no caminho canônico, com 10 tools MCP
  descobertas; health de Hermes e Bridge permaneceu verde;
- o gate final append-only alterou a campanha
  `HML F4 Final 20260729-C` da versão 2 para 3 somente após `vamos nessa`,
  preservando a nota existente;
- a resposta expôs um elemento real `link` chamado `Abrir campanha`, com
  `href=/marketing-ops/campaigns/6c09b64a-fe76-46ee-8edb-c2039d73fa2d`; o
  clique abriu a campanha correta, sem copiar, colar ou sintetizar rota;
- o evento de auditoria `c0c8a13e-f323-44a7-b576-1e854cf0ad8f` correlacionou
  sessão `9407e388-c8b5-47f5-97d2-a35406845f19`, run
  `88fb782f-bd94-4473-870b-57ff217554d5`, tool call
  `eb95aae4-1869-47d3-afdb-768a438681a7` e plano
  `4bd13e09-0b35-443d-ab23-d025186d7c2e`;
- limitação ambiental local explicitada: Docker/PostgreSQL não estão
  disponíveis nesta máquina, portanto pgTAP/reset/lint de banco local não
  foram simulados; migration, comportamento persistido e RLS foram validados
  no Supabase/VPS reais por gates seguros e rastreáveis.

## Resíduos conhecidos

- conflito controlado, rate limit e indisponibilidade permanecem cobertos por
  testes automatizados; não foram provocados destrutivamente no site público;
- a primeira tentativa de `prepare_plan_v1` do gate final recebeu
  `invalid_union`, foi recusada antes de assinatura/persistência e o Hermes
  refez a chamada correta. O comportamento fail-closed funcionou e não deixou
  impacto de dados; o evento permanece como telemetria operacional
  não bloqueante para otimização futura de latência.

## Decisão

**A Fase 4 está `production_validated`.** O último gate foi executado no app
real com a skill `1.2.4`: ausência de escrita antes da confirmação, decisão
contextual positiva, append-only, auditoria completa, deep link Markdown
clicável e navegação até o objeto correto foram comprovados. Os resíduos acima
são limitações operacionais aceitas, não lacunas do escopo funcional.
