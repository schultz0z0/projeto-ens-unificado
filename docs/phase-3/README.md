# Fase 3 — Calendário e Esteira de Produção

Este diretório reúne o contrato, a implementação executada e as evidências de
encerramento da Fase 3 no padrão documental das Fases 0–2. O código, o schema,
o deploy e a homologação manual na VPS foram reconciliados neste pacote.

## Status

- **Fase:** `production_validated`
- **Snapshot reconciliado:** 2026-07-20
- **Tasks:** 1–10 concluídas
- **Homologação VPS:** aprovada em 2026-07-20
- **Supabase remoto:** `production_validated`
- **Branch única:** `main`
- **Dependência:** Fase 2 `production_validated`
- **PRD:** [phase-3-calendario-esteira-producao.md](../prds/phase-3-calendario-esteira-producao.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-18-phase-3-calendario-esteira-producao-implementation.md](../plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md)

## Pacote documental

| Entregável/gate | Estado | Evidência |
|---|---|---|
| PRD/design/plano | `approved_as_built` | PRD, design e plano |
| Tasks 1–10 | `completed` | [progresso](implementation-progress.md) |
| Rastreabilidade F3-RF-01–12 | `closed` | [rastreabilidade](requirements-traceability.md) |
| Supabase local | `verified_local_2026-07-19` | reset, 322/322 pgTAP, lint/diff |
| Supabase remoto | `production_validated` | [deploy](supabase-deployment.md) |
| Marketing Ops | `production_validated` | 181 testes, tipos e build + homologação VPS |
| Frontend | `production_validated` | 179 testes, lint, tipos, build, E2E e jornada manual |
| Artifact/RAG | `production_validated` | 8 + 26 testes + probes na VPS |
| Performance | `production_validated` | 5 mil campanhas e 10 mil itens abaixo de 500 ms |
| Docker/Linux | `production_validated` | build, health/readiness, logs e restart |
| Operação/rollback | `executed_and_reusable` | [runbook](runbook.md), [rollback](rollback.md) |
| Homologação VPS | `production_validated` | [checklist](vps-validation.md) |
| Incidente do primeiro gate VPS | `historical_record` | [evidência](vps-gate-incident-2026-07-19.md) |

## Escopo entregue

- item operacional aditivo sobre `campaign_items`;
- lista acessível, semana e mês sobre a mesma query canônica;
- UTC no banco e timezone IANA na apresentação;
- estados `draft`, `ready`, `in_review`, `completed`, `cancelled`;
- dependências direcionadas sem ciclos/deadlocks;
- assets estáveis e versões append-only;
- artifacts com ownership e persistência;
- notificações somente in-app e payload allowlisted;
- lote seguro para reatribuição, prioridade e reagendamento;
- métricas de baixa cardinalidade, logs redigidos e readiness real;
- script VPS fail-closed, rollback e checklist manual.

Continuam fora do escopo: aprovação, execução/publicação, recorrência,
drag-and-drop obrigatório e notificações externas.

## Evidência consolidada

- Supabase: reset fresco, 6 arquivos e 322/322 pgTAP; lint sem erro e diff vazio;
- Marketing Ops: 181 pass, 2 E2E condicionais skipped; typecheck/build verdes;
- frontend: 179/179; lint zero erro/10 warnings históricos; typecheck/build;
- Artifact Server 8/8 e RAG MCP 26/26;
- performance final fresca: lista 5.000 campanhas p95 38,41 ms; agenda 10.000
  itens p95 45,45 ms;
- E2E Phase 3 real em Docker: jornada integrada, mobile e axe aprovados;
- quatro imagens construídas sem cache e quatro serviços healthy;
- `/metrics` protegido, readiness, redaction de logs e persistência após restart
  aprovados;
- security gate sem vulnerabilidade alta/crítica;
- migrations remotas aplicadas após backup e dry-run, com invariantes
  conferidas.
- deploy de produção e homologação manual na VPS aprovados pelo usuário em
  2026-07-20;
- aceite final registrado sem falha alta/crítica conhecida na fase.

Detalhes e bugs corrigidos estão em [local-validation.md](local-validation.md).

## Decisão

**Fase 3 encerrada como `production_validated`.** O gate de produção foi
aprovado pelo usuário em 2026-07-20 após deploy, smokes manuais, logs,
restart, cleanup e aceite funcional conforme [vps-validation.md](vps-validation.md).
