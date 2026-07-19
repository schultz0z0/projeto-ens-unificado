# Fase 3 — Calendário e Esteira de Produção

Este diretório é a fonte de evidência da implementação da Fase 3 no padrão
documental das Fases 0–2. O código e o schema estão completos; o aceite de
produção permanece reservado ao gate executado pelo usuário na VPS.

## Status

- **Fase:** `in_progress`
- **Subestado:** `implementation_complete_pending_vps_validation`
- **Snapshot:** 2026-07-19
- **Implementação:** Tasks 1–10 completas
- **Progresso de implementação:** 100%
- **Supabase remoto:** `deployed_pending_vps_validation`
- **Branch única:** `main`
- **Dependência:** Fase 2 `production_validated`
- **PRD:** [phase-3-calendario-esteira-producao.md](../prds/phase-3-calendario-esteira-producao.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-07-18-phase-3-calendario-esteira-producao-implementation.md](../plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md)

## Matriz de fechamento interno

| Entregável/gate | Estado | Evidência |
|---|---|---|
| PRD/design/plano | `implemented_as_approved` | PRD, design e plano |
| Tasks 1–10 | `validated_locally` | [progresso](implementation-progress.md) |
| Rastreabilidade F3-RF-01–12 | `validated_locally` | [rastreabilidade](requirements-traceability.md) |
| Supabase local | `validated_locally` | reset, 322/322 pgTAP, lint/diff |
| Supabase remoto | `deployed_pending_vps_validation` | [deploy](supabase-deployment.md) |
| Marketing Ops | `validated_locally` | 181 testes, tipos e build |
| Frontend | `validated_locally` | 179 testes, lint, tipos, build e E2E |
| Artifact/RAG | `validated_locally` | 8 + 26 testes |
| Performance | `validated_locally` | 5 mil campanhas e 10 mil itens abaixo de 500 ms |
| Docker/Linux | `validated_locally` | build limpo, health/readiness, logs e restart |
| Operação/rollback | `ready_for_vps_execution` | [runbook](runbook.md), [rollback](rollback.md) |
| Homologação VPS | `pending_user_reexecution_after_gate_fix` | [checklist](vps-validation.md) |
| Incidente/reteste do gate VPS | `fixed_locally_pending_vps_retest` | [evidência](vps-gate-incident-2026-07-19.md) |

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

## Evidência final local

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

Detalhes e bugs corrigidos estão em [local-validation.md](local-validation.md).

## Decisão

**GO para publicação do `main` e homologação controlada na VPS.** A
implementação está 100% concluída, mas a Fase 3 ainda não está `completed` nem
`production_validated`. Esses estados exigem build/deploy, smokes manuais,
logs, restart, cleanup e aceite do usuário conforme
[vps-validation.md](vps-validation.md).
