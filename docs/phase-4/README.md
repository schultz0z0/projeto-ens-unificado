# Fase 4 — Hermes Campaign Operator

Este diretório reúne o planejamento técnico, os contratos e a preparação
operacional da Fase 4 no padrão documental das Fases 0–3. A fase ainda não foi
implementada; este pacote existe para reduzir ambiguidade antes do primeiro
ciclo de execução.

## Status

- **Fase:** `ready_for_implementation`
- **Snapshot de planejamento:** 2026-07-22
- **Implementação:** `not_started`
- **Dependência:** Fase 3 `production_validated`
- **PRD:** [phase-4-hermes-campaign-operator.md](../prds/phase-4-hermes-campaign-operator.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-20-phase-4-hermes-campaign-operator-implementation.md](../plans/2026-07-20-phase-4-hermes-campaign-operator-implementation.md)

## Pacote documental

| Entregável/gate | Estado | Evidência |
|---|---|---|
| PRD | `canonical_reviewed` | PRD reconciliado com Roadmap e baseline da Fase 3 |
| Design técnico | `approved_baseline` | [design.md](design.md) |
| Plano de execução | `ready` | [implementation plan](../plans/2026-07-20-phase-4-hermes-campaign-operator-implementation.md) |
| Tasks 1–8 | `not_started` | [progresso](implementation-progress.md) |
| Rastreabilidade completa | `planned` | [rastreabilidade](requirements-traceability.md) |
| Registro de riscos | `seeded` | [risk-register.md](risk-register.md) |
| Supabase/app schema | `required_planned` | [supabase-deployment.md](supabase-deployment.md) |
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

## Contratos congelados

- Roadmap e PRD são as fontes canônicas da fase;
- tools diretas legadas de mutação saem do catálogo MCP;
- RAG fundamenta fatos e tom ENS; Graph atende relações/trabalhos validados;
- auditoria distingue transporte `mcp` de operador `hermes` e persiste
  chat/run/tool/plano/ação;
- execução parcial retorna resultado por ação e respeita dependências;
- deep links seguem somente os templates definidos no design;
- rate limit MCP é aplicado por ator e ferramenta;
- briefing → calendário/checklist, chat → versão e revisão ENS são jornadas E2E
  obrigatórias.

## Saída esperada da fase

- o Hermes consulta campanhas e agenda reais antes de responder;
- o Hermes cria e altera objetos reais após confirmação explícita;
- o frontend recebe IDs/deep links consistentes com os objetos persistidos;
- conflitos, retries e negações são comunicados sem falso sucesso;
- a trilha de auditoria correlaciona o operador humano, a origem `hermes`, a
  sessão, a run e a ferramenta usada.

## Decisão atual

**A Fase 4 está pronta para iniciar a Task 1 do plano reconciliado.** Cada task
deve registrar RED, GREEN, comandos, arquivos e evidências neste pacote antes
de a task seguinte começar.
