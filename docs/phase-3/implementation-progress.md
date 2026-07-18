# Progresso de implementação da Fase 3

- **Estado:** `in_progress`
- **Progresso:** 10%
- **Snapshot:** 2026-07-18
- **Branch única:** `main`
- **Próxima task:** Task 2 — CRUD e máquina de estados

| Task | Entregável | Estado | Evidência |
|---:|---|---|---|
| 1 | gate, tipos, migration, RLS e backfill | `validated_locally` | 295 pgTAP; 19 contratos; reset/lint/diff verdes |
| 2 | CRUD e máquina de estados | `not_started` | — |
| 3 | agenda, query canônica e timezone | `not_started` | — |
| 4 | grafo de dependências | `not_started` | — |
| 5 | conteúdo, versões e artifacts | `not_started` | — |
| 6 | REST/OpenAPI e client tipado | `not_started` | — |
| 7 | lista acessível | `not_started` | — |
| 8 | views semana e mês | `not_started` | — |
| 9 | notificações in-app e lote | `not_started` | — |
| 10 | E2E, performance, docs e handoff VPS | `not_started` | — |

## Protocolo

Ao concluir uma task:

1. registrar teste RED realmente observado;
2. registrar GREEN e comandos frescos;
3. atualizar rastreabilidade/riscos/evidência;
4. criar commit local pequeno;
5. não promover gate remoto sem execução real.

## Ciclo Task 1 — 2026-07-18

- RED de aplicação observado: 5 falhas em 19 testes pela ausência dos schemas e
  da matriz de transição de item.
- RED de banco observado: os dois arquivos novos falharam antes da migration
  por ausência de tipos, campos, tabelas e RLS.
- Migration gerada pelo CLI:
  `20260718193003_phase_3_calendar_production_pipeline.sql`.
- Conversão in-place preserva `id`/`version`, normaliza kind legado e mapeia
  `archived` para `cancelled`, mantendo `archived_at` como evidência compatível.
- GREEN: reset completo, 295/295 pgTAP, 19/19 contratos, 135/135 testes do
  serviço, typecheck e build.
- Banco: lint sem erros e diff vazio.
- Incidente corrigido: duas execuções simultâneas de `supabase test db`
  disputaram a ativação do pgTAP. A reprodução isolada confirmou concorrência
  do CLI; os gates Supabase passam quando serializados.
- Advisors remotos consultados em modo read-only. Os achados são baseline
  legado fora das tabelas da Fase 3; a migration ainda não foi promovida.
- O clone não possui link local do Supabase CLI; `migration list --linked`
  retorna `LegacyProjectNotLinkedError`. O deploy remoto permanece bloqueado
  até o gate final da fase.
