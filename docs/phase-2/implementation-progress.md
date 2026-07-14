# Progresso de implementação da Fase 2

- **Estado da fase:** `in_progress`
- **Snapshot:** 2026-07-14
- **Branch canônica:** `main`
- **Último código da fase:** `5d5cf8f`
- **Deploy Supabase da Fase 2:** não executado
- **Deploy VPS da Fase 2:** não executado
- **Próxima task:** Task 8 — timeline segura e auditoria minimizada

## Legenda de estados

| Estado | Significado |
|---|---|
| `not_started` | implementação ainda não iniciada |
| `in_progress` | código ou testes em elaboração |
| `completed_reviewed` | escopo executável neste ambiente concluído e revisado, sem gate externo pendente para a task |
| `implemented_pending_vps_validation` | implementação e checks nativos concluídos; prova PostgreSQL/Linux/Compose obrigatória ainda pendente |
| `implementation_complete_pending_vps_validation` | Tasks 1–15 fechadas internamente; fase ainda `in_progress` até deploy e aceite VPS |
| `production_validated` | deploy, gate VPS e aceite manual registrados |

## Quadro de execução

| Task | Escopo | Commit de código | Evidência atual | Estado |
|---:|---|---|---|---|
| 1 | Gate de entrada, PRD/design/plano e contrato de ambiente | `32c2ae4`, `4ed2829`, `ccf20d1` | baseline local histórico e documentação reconciliada | `completed_reviewed` |
| 2 | Schema, RLS, agregado, owner principal e concorrência | `c921294` | checks nativos e revisão estática; 221 asserts e harness real diferidos | `implemented_pending_vps_validation` |
| 3 | Contratos estritos e máquina de estados | `9740530` | 13 testes da task, regressão nativa, typecheck e build | `completed_reviewed` |
| 4 | CRUD, busca, filtros, versão e transições | `9b19ec7` | 37 testes nativos; 12 cenários PostgreSQL coletados | `implemented_pending_vps_validation` |
| 5 | Participantes, owner principal e perfis seguros | `2c119f8` | 39 checks nativos; 5 cenários PostgreSQL coletados | `implemented_pending_vps_validation` |
| 6 | Materiais e integração Artifact Server | `aed3e1c` | 8 contratos Marketing Ops, 8 testes Artifact e Compose estático; 3 cenários DB coletados | `implemented_pending_vps_validation` |
| 7 | Referências oficiais read-only via RAG MCP | `5d5cf8f` | 10 contratos da task, 26 testes RAG e Compose estático; persistência real coletada | `implemented_pending_vps_validation` |
| 8 | Timeline segura e auditoria minimizada | — | teste e implementação ainda não iniciados | `not_started` |
| 9 | Consolidação REST v1 e OpenAPI | — | não iniciada | `not_started` |
| 10 | Cliente frontend tipado | — | não iniciada | `not_started` |
| 11 | Lista, filtros em URL e criação | — | não iniciada | `not_started` |
| 12 | Workspace, salvamento e conflito | — | não iniciada | `not_started` |
| 13 | Participantes, materiais e timeline na UI | — | não iniciada | `not_started` |
| 14 | Observabilidade, Compose, E2E e fechamento documental | — | não iniciada; pacote documental-base antecipado após auditoria de processo | `not_started` |
| 15 | Revisão final no `main` e handoff VPS | — | não iniciada | `not_started` |

## Evidências consolidadas até a Task 7

- baseline histórico: 197 pgTAP, lint sem erro, schema diff vazio e primeiro harness campanha/participante aprovado no computador anterior;
- correção atual da Task 2: 221 asserts esperados, harness ampliado e provas reais marcadas `deferred_to_vps`;
- Marketing Ops: suítes nativas segmentadas, typecheck e build aprovados em cada task executada;
- Artifact Server: 8/8 testes nativos aprovados;
- RAG MCP: 26/26 testes e typecheck aprovados;
- Compose: parsing e vínculos estáticos de Artifact/RAG aprovados, sem alegação de build ou execução Linux;
- remoto: nenhum deploy Supabase ou VPS da Fase 2 executado.

As contagens e comandos completos estão em [local-validation.md](local-validation.md). Os requisitos parcialmente atendidos estão em [requirements-traceability.md](requirements-traceability.md).

## Sequência de continuidade

1. Task 8: impedir novos snapshots brutos sensíveis e publicar timeline minimizada.
2. Task 9: fechar inventário REST, erros, ETags e OpenAPI.
3. Tasks 10–13: cliente tipado e experiência operacional completa.
4. Task 14: observabilidade final, E2E, gate reproduzível e fechamento interno.
5. Task 15: revisão fresca do `main`, deploy Supabase do app quando autorizado pelos gates e handoff VPS.
6. Usuário publica `main` e executa o deploy VPS.
7. Agente conduz logs, smokes por papel e registro do aceite final.

## Protocolo de atualização

Ao finalizar cada task:

1. registrar RED/GREEN apenas para testes realmente executados;
2. listar nominalmente qualquer teste `deferred_to_vps`;
3. atualizar este quadro, [local-validation.md](local-validation.md) e a rastreabilidade afetada;
4. atualizar [continuation-handoff.md](continuation-handoff.md) com commit, decisão e próxima ação;
5. manter Roadmap, PRD e README coerentes com o mesmo estado;
6. criar commit local testado, sem `git push`.

Nenhuma contagem histórica ou inspeção estática promove uma task dependente de banco/containers para `completed`.
