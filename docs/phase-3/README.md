# Fase 3 — Calendário e Esteira de Produção

Este diretório é o pacote de entrada da Fase 3 no padrão documental das Fases
0–2. Ele define o que será implementado; não contém alegação de código, schema,
deploy ou teste já executado.

## Status

- **Fase:** `ready_for_implementation`
- **Snapshot:** 2026-07-18
- **Implementação:** `not_started`
- **Progresso:** 0%
- **Branch única:** `main`
- **Dependência:** Fase 2 `production_validated`
- **PRD:** [phase-3-calendario-esteira-producao.md](../prds/phase-3-calendario-esteira-producao.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-18-phase-3-calendario-esteira-producao-implementation.md](../plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md)

## Pacote aprovado

| Entregável | Estado |
|---|---|
| PRD | `approved` |
| Design técnico | `approved` |
| Rastreabilidade inicial | `approved_for_execution` |
| Registro de riscos | `active_before_implementation` |
| Plano TDD | `approved` |
| Progresso | `not_started` |
| Handoff | `ready` |

## Corte técnico

- evolução aditiva de `campaign_items`;
- lista é a referência acessível;
- lista, semana e mês usam a mesma query por intervalo;
- UTC no banco, timezone do tenant na apresentação;
- estados disponíveis: `draft`, `ready`, `in_review`, `completed`,
  `cancelled`;
- estados de aprovação/execução permanecem indisponíveis;
- dependências direcionadas, mesma campanha e sem ciclos;
- conteúdo com asset estável e versões append-only;
- notificações somente in-app;
- lote limitado a reatribuição, prioridade e reagendamento;
- sem drag-and-drop obrigatório e sem recorrência.

## Gate de entrada

| Dependência | Estado |
|---|---|
| Fase 2 funcional/VPS | `production_validated` |
| Saneamento local da Fase 2 | verde |
| Falha alta/crítica conhecida | nenhuma |
| Forward-fix de índice da Fase 2 | `accepted_residual`; aplicar antes do próximo gate VPS |
| PRD/design/plano da Fase 3 | coerentes e aprovados |
| Migration/código da Fase 3 | inexistente, como esperado |

## Governança

- executar diretamente em `main`, sem criar branch;
- aplicar TDD task a task e registrar RED/GREEN real;
- criar commits locais pequenos após gates;
- o agente não executa `git push` nem deploy VPS;
- deploy Supabase somente após testes, backup e dry-run aprovados;
- atualizar progresso, rastreabilidade e evidência no mesmo ciclo de cada task;
- não promover a fase antes de local + VPS.

## Decisão de entrada

**GO técnico documental:** a implementação da Fase 3 pode iniciar. Este GO não
autoriza deploy e não afirma que qualquer critério funcional da Fase 3 foi
atendido.
