# Progresso de implementação da Fase 3

- **Estado:** `in_progress`
- **Progresso:** 30%
- **Snapshot:** 2026-07-18
- **Branch única:** `main`
- **Próxima task:** Task 4 — grafo de dependências acíclico

| Task | Entregável | Estado | Evidência |
|---:|---|---|---|
| 1 | gate, tipos, migration, RLS e backfill | `validated_locally` | 295 pgTAP; 19 contratos; reset/lint/diff verdes |
| 2 | CRUD e máquina de estados | `validated_locally` | 7 cenários novos; 142 testes do serviço verdes |
| 3 | agenda, query canônica e timezone | `validated_locally` | 299 pgTAP; p95 40,02 ms/10 mil itens; 153 testes verdes |
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

## Ciclo Task 2 — 2026-07-18

- RED observado: 7/7 cenários novos falharam porque
  `createProductionItem`/get/patch/transition/cancel ainda não existiam; os 5
  testes do production gate anterior permaneceram verdes.
- Implementados create/get/patch/transition/cancel com transação de ator,
  idempotência, versão otimista, readiness, terminalidade, auditoria minimizada
  e outbox.
- Compatibilidade mantida nos adapters legados
  `createCampaignItemDraft`/`updateCampaignItemDraft`, inclusive para `content`.
- Autoridade de member exige campanha editável e, para transição, assignee ou
  owner; manager/admin operam no tenant autorizado. Cross-tenant retorna 404.
- GREEN focado: 12/12 (`items.test.ts` + `production-gate.test.ts`).
- GREEN amplo: 142/142 testes do serviço, 2 E2E condicionais skipped,
  typecheck e build.
- Bug corrigido: o teste antigo de paginação reutilizava “Nexus Alpha” e
  acumulava fixtures entre execuções. O termo agora é único por teste e o gate
  pode ser repetido sem reset.
- Decisão documental: os cenários da Fase 3 ficam em `items.test.ts`; o arquivo
  `production-gate.test.ts` continua representando os testes manuais 15–20 da
  Fase 1 e não recebeu cenários de semântica diferente.

## Ciclo Task 3 — 2026-07-18

- RED funcional observado: o módulo de scheduling e
  `listProductionSchedule` não existiam.
- RED de volume observado: a primeira consulta canônica atingiu p95 de
  2.566,34 ms com 10.000 itens, acima do limite de 500 ms.
- O `EXPLAIN (ANALYZE, BUFFERS)` identificou chamadas RLS por linha:
  2.401,49 ms e 195.471 buffer hits.
- A correção centralizou autorização e consulta na função privada
  `list_production_schedule`, `security definer`, `search_path` vazio e EXECUTE
  somente para `authenticated`. O isolamento cross-tenant foi exercitado.
- Pós-correção: função em 18,68 ms no EXPLAIN e gate dedicado com p95 de
  40,02 ms/10.000 itens. Não foi criado índice especulativo.
- Range `[from,to)`, filtros combinados, cursor estável, itens sem data,
  viradas de mês/ano, atraso/bloqueio e IANA/DST ficaram cobertos.
- Timezone padrão explícito em Compose/.env:
  `America/Sao_Paulo`, ainda configurável por ambiente.
- GREEN amplo: 299/299 pgTAP, lint vazio, diff vazio, 153/153 testes de
  serviço, 2 E2E condicionais skipped, typecheck e build.
