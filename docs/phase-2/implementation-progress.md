# Progresso de implementação da Fase 2

- **Estado da fase:** `in_progress`
- **Snapshot:** 2026-07-14
- **Branch canônica:** `main`
- **Último código da fase:** `7fcbd21`
- **Deploy Supabase da Fase 2:** não executado
- **Deploy VPS da Fase 2:** não executado
- **Próxima task:** Task 13 — participantes, materiais e timeline na UI

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
| 2 | Schema, RLS, agregado, owner principal e concorrência | `c921294` | checks nativos e revisão estática; total atual de 228 asserts e harness real diferidos | `implemented_pending_vps_validation` |
| 3 | Contratos estritos e máquina de estados | `9740530` | 13 testes da task, regressão nativa, typecheck e build | `completed_reviewed` |
| 4 | CRUD, busca, filtros, versão e transições | `9b19ec7` | 37 testes nativos; 12 cenários PostgreSQL coletados | `implemented_pending_vps_validation` |
| 5 | Participantes, owner principal e perfis seguros | `2c119f8` | 39 checks nativos; 5 cenários PostgreSQL coletados | `implemented_pending_vps_validation` |
| 6 | Materiais e integração Artifact Server | `aed3e1c` | 8 contratos Marketing Ops, 8 testes Artifact e Compose estático; 3 cenários DB coletados | `implemented_pending_vps_validation` |
| 7 | Referências oficiais read-only via RAG MCP | `5d5cf8f` | 10 contratos da task, 26 testes RAG e Compose estático; persistência real coletada | `implemented_pending_vps_validation` |
| 8 | Timeline segura e auditoria minimizada | `42d43f3` | 7 testes da task e 65 checks nativos segmentados; 7 asserts pgTAP adicionados e diferidos | `implemented_pending_vps_validation` |
| 9 | Consolidação REST v1 e OpenAPI | `6c713e7` | 75 testes nativos segmentados, typecheck/build e Redocly válidos; 17 cenários integrados diferidos | `implemented_pending_vps_validation` |
| 10 | Cliente frontend tipado | `32acff2` | RED das APIs ausentes; 11 testes focados, regressão frontend 131/131, lint sem erro, typecheck e build verdes; integração real diferida | `implemented_pending_vps_validation` |
| 11 | Lista, filtros em URL e criação | `df4903b` | RED dos componentes ausentes; 5 testes de jornada, regressão frontend 136/136, QA Chrome desktop/mobile, segurança, tipos e build verdes; API/DB/E2E VPS diferidos | `implemented_pending_vps_validation` |
| 12 | Workspace, salvamento e conflito | `7fcbd21` | RED dos módulos ausentes; 6 testes focados, regressão frontend 142/142, QA Chrome desktop/tablet/mobile, segurança, tipos e build verdes; API/DB/E2E VPS diferidos | `implemented_pending_vps_validation` |
| 13 | Participantes, materiais e timeline na UI | — | não iniciada | `not_started` |
| 14 | Observabilidade, Compose, E2E e fechamento documental | — | não iniciada; pacote documental-base antecipado após auditoria de processo | `not_started` |
| 15 | Revisão final no `main` e handoff VPS | — | não iniciada | `not_started` |

## Evidências consolidadas até a Task 12

- baseline histórico: 197 pgTAP, lint sem erro, schema diff vazio e primeiro harness campanha/participante aprovado no computador anterior;
- banco atual: 228 asserts esperados (`2 + 95 + 33 + 98`), harness ampliado e provas reais marcadas `deferred_to_vps`;
- Marketing Ops: suítes nativas segmentadas, typecheck e build aprovados em cada task executada;
- timeline: snapshots de texto livre são reduzidos a presença/tamanho/SHA-256, secrets são redigidos e a projeção limita ações/campos por allowlist;
- REST/OpenAPI: 18 paths e 22 operações em lockstep com o Express, schemas estritos, ETags/headers de mutação e erros públicos documentados;
- frontend: client cobre campanhas, transições, participantes, materiais, timeline e referências; upload preserva `File` bruto, ETag/correlação são expostos e conflitos carregam `currentVersion`;
- lista frontend: filtros combináveis em URL, paginação por cursor, criação name-only, tabela desktop, cards mobile, estados loading/vazio/erro/acesso negado e correlação;
- gate frontend da Task 11: 5/5 testes de jornada, 136/136 na regressão completa, ESLint focado sem achados, lint global com zero erro e 10 warnings preexistentes, typecheck, build e security gate aprovados;
- QA real da Task 11: Chrome em 1440×900 e 390×844, filtros e criação exercitados, largura sem overflow e console sem warning/erro;
- workspace frontend: edição explícita sem autosave, validação de datas/canais, referência oficial, transições, archive terminal/read-only e comparação de conflito 409 com descarte ou reaplicação;
- gate frontend da Task 12: 6/6 testes focados, 142/142 na regressão completa, ESLint focado limpo, lint global com zero erro e os mesmos 10 warnings legados, typecheck, build e security gate aprovados;
- QA real da Task 12: Chrome em 1440×900, 768×900 e 390×844, conflito/reaplicação, transição e archive exercitados, sem overflow; aba final limpa sem warning/erro;
- Artifact Server: 8/8 testes nativos aprovados;
- RAG MCP: 26/26 testes e typecheck aprovados;
- Compose: parsing e vínculos estáticos de Artifact/RAG aprovados, sem alegação de build ou execução Linux;
- remoto: nenhum deploy Supabase ou VPS da Fase 2 executado.

As contagens e comandos completos estão em [local-validation.md](local-validation.md). Os requisitos parcialmente atendidos estão em [requirements-traceability.md](requirements-traceability.md).

## Sequência de continuidade

1. Task 13: completar participantes, materiais e timeline sobre o workspace e o client tipado.
2. Task 14: observabilidade final, E2E, gate reproduzível e fechamento interno.
3. Task 15: revisão fresca do `main`, deploy Supabase do app quando autorizado pelos gates e handoff VPS.
4. Usuário publica `main` e executa o deploy VPS.
5. Agente conduz logs, smokes por papel e registro do aceite final.

## Protocolo de atualização

Ao finalizar cada task:

1. registrar RED/GREEN apenas para testes realmente executados;
2. listar nominalmente qualquer teste `deferred_to_vps`;
3. atualizar este quadro, [local-validation.md](local-validation.md) e a rastreabilidade afetada;
4. atualizar [continuation-handoff.md](continuation-handoff.md) com commit, decisão e próxima ação;
5. manter Roadmap, PRD e README coerentes com o mesmo estado;
6. criar commit local testado, sem `git push`.

Nenhuma contagem histórica ou inspeção estática promove uma task dependente de banco/containers para `completed`.
