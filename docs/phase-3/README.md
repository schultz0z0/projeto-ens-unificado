# Fase 3 — Calendário e Esteira de Produção

Este diretório reúne o pacote aprovado e a evidência de implementação da Fase 3
no padrão documental das Fases 0–2. Evidências locais só são promovidas após
execução real; o aceite de produção continua reservado ao gate VPS.

## Status

- **Fase:** `in_progress`
- **Snapshot:** 2026-07-19
- **Implementação:** `tasks_1_to_9_validated_locally`
- **Progresso:** 90%
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
| Registro de riscos | `active_during_implementation` |
| Plano TDD | `approved` |
| Progresso | `90_percent` |
| Handoff | `ready_to_start_task_10` |

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
| Migration/código da Fase 3 | Tasks 1–9 validadas localmente; sem deploy remoto |

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

## Gate final de entrada — 18/07/2026

| Gate obrigatório | Evidência | Decisão |
|---|---|---|
| Fase 2 | produção homologada + documentação as built | `go` |
| Banco local | reset, 228/228 pgTAP, lint zero erro, diff vazio | `go` |
| Performance Fase 2 | 5.000 campanhas, p95 28,50 ms | `go` |
| Marketing Ops | 129 testes, tipos, build, OpenAPI e concorrência | `go` |
| Frontend | 158 testes, lint 0 erros, tipos, build e security gate | `go` |
| Artifact/RAG | 8 + 26 testes; RAG typecheck | `go` |
| Compose | config válido e imagens alvo construídas | `go` |
| PRD/design/plano Fase 3 | aprovados e consistentes | `go` |
| Falha alta/crítica conhecida | nenhuma | `go` |

### Resíduos não bloqueantes

- migration de índice da Fase 2 ainda não aplicada no Supabase remoto;
- 79 warnings de advisors, sendo 8 Marketing Ops `auth_rls_initplan`, zero
  erro;
- 10 warnings históricos de lint no frontend, zero erro;
- bundle principal acima de 500 kB;
- dependência de desenvolvimento do RAG com um advisory de severidade baixa;
- adoção ampla sem planilhas e prazo jurídico de retenção permanecem métricas/
  decisões externas.

### Parecer

**GO para iniciar a Task 1 da Fase 3 em ambiente local.** Antes do próximo gate
de produção, aplicar o índice pendente da Fase 2 pelo fluxo de
backup/dry-run/push e revalidar os resíduos no contexto das mudanças da Fase 3.
