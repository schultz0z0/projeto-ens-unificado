# Fase 4 — Hermes Campaign Operator

Este diretório reúne o planejamento técnico, os contratos e a preparação
operacional da Fase 4 no padrão documental das Fases 0–3. A fase ainda não foi
implementada; este pacote existe para reduzir ambiguidade antes do primeiro
ciclo de execução.

## Status

- **Fase:** `planned`
- **Snapshot de planejamento:** 2026-07-20
- **Implementação:** `not_started`
- **Dependência:** Fase 3 `production_validated`
- **PRD:** [phase-4-hermes-campaign-operator.md](../prds/phase-4-hermes-campaign-operator.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-20-phase-4-hermes-campaign-operator-implementation.md](../plans/2026-07-20-phase-4-hermes-campaign-operator-implementation.md)

## Pacote documental

| Entregável/gate | Estado | Evidência |
|---|---|---|
| PRD | `draft_reviewed` | PRD reconciliado com Roadmap e baseline da Fase 3 |
| Design técnico | `planned` | [design.md](design.md) |
| Plano de execução | `planned` | [implementation plan](../plans/2026-07-20-phase-4-hermes-campaign-operator-implementation.md) |
| Tasks 1–8 | `not_started` | [progresso](implementation-progress.md) |
| Rastreabilidade F4-RF-01–12 | `seeded` | [rastreabilidade](requirements-traceability.md) |
| Registro de riscos | `seeded` | [risk-register.md](risk-register.md) |
| Supabase/app schema | `conditional_not_decided` | [supabase-deployment.md](supabase-deployment.md) |
| Gate local | `not_executed` | [local-validation.md](local-validation.md) |
| Operação/rollback | `planned` | [runbook.md](runbook.md), [rollback.md](rollback.md) |
| Gate VPS | `not_executed` | [vps-validation.md](vps-validation.md) |
| Handoff | `placeholder` | [continuation-handoff.md](continuation-handoff.md) |

## Escopo planejado

- expor leituras MCP do domínio já entregue nas Fases 2–3 para campanhas,
  agenda, timeline, conteúdo e capacidades por objeto;
- ampliar o contrato de `prepare_plan_v1` e `execute_plan_v1` para mutações
  reais de campanha, item, conteúdo, artefato e nota;
- manter defesa em profundidade: sem SQL direto, sem bypass de papel, sem
  mutação direta fora do fluxo de plano assinado e confirmação posterior;
- devolver resultados com deep links, IDs reais, conflito explícito e falha
  parcial visível;
- fechar correlação ponta a ponta entre chat, run, ferramenta, auditoria e
  objeto alterado.

## Premissas aprovadas para o design

- o `marketing-ops` continua como única fonte transacional;
- a maior parte do domínio da Fase 4 já existe em `services/marketing-ops`
  via domínio e REST;
- a principal lacuna da fase está na borda MCP e na integração Hermes/Bridge,
  não no modelo operacional base;
- leituras MCP podem ser diretas;
- mutações continuam obrigatoriamente mediadas por `prepare_plan_v1` e
  `execute_plan_v1`, mesmo quando o PRD nomeia "ferramentas de escrita".

## Saída esperada da fase

- o Hermes consulta campanhas e agenda reais antes de responder;
- o Hermes cria e altera objetos reais após confirmação explícita;
- o frontend recebe IDs/deep links consistentes com os objetos persistidos;
- conflitos, retries e negações são comunicados sem falso sucesso;
- a trilha de auditoria correlaciona o operador humano, a origem `hermes`, a
  sessão, a run e a ferramenta usada.

## Decisão atual

**A Fase 4 está pronta para revisão técnica e início controlado da execução.**
O próximo passo não é desenvolver imediatamente, mas revisar este pacote,
confirmar o escopo do primeiro ciclo e só então iniciar as tasks do plano.
