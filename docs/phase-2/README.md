# Fase 2 — Workspace Operacional MVP

Este diretório reúne o design aprovado, o estado de execução, as evidências locais e o handoff da Fase 2. A documentação segue a separação usada nas Fases 0 e 1 entre implementação local, prontidão para deploy e validação de produção.

## Status

- **Fase:** `in_progress`
- **Data do snapshot:** 2026-07-14
- **Branch canônica:** `main`
- **Base de produção:** Fase 1 `production_validated`
- **Implementação:** Task 1 concluída; Tasks 2 e 4–10 em `implemented_pending_vps_validation`; Task 3 `completed_reviewed`; Tasks 11–15 não iniciadas
- **Deploy Supabase remoto:** não executado
- **Deploy VPS:** não executado
- **PRD:** [phase-2-workspace-operacional-mvp.md](../prds/phase-2-workspace-operacional-mvp.md)
- **Design técnico:** [design.md](design.md)
- **Plano:** [2026-07-13-phase-2-workspace-operacional-mvp-implementation.md](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Progresso detalhado:** [implementation-progress.md](implementation-progress.md)
- **Continuação obrigatória:** [continuation-handoff.md](continuation-handoff.md)
- **Evidência local atual:** [local-validation.md](local-validation.md)

O backend das Tasks 2–9 e o client frontend tipado da Task 10 estão implementados. Os checks nativos disponíveis neste computador estão registrados, mas as Tasks 2 e 4–10 **não estão concluídas**: PostgreSQL/RLS, REST/MCP e client/API integrados, concorrência, integrações reais, imagens Linux, Compose, restart e persistência serão comprovados na VPS. A Task 11 é a próxima frente de implementação.

## Pacote documental

| Entregável | Estado | Documento |
|---|---|---|
| Índice e governança da fase | `current` | este README |
| Design técnico aprovado | `approved` | [design.md](design.md) |
| Progresso por task | `current_through_task_10` | [implementation-progress.md](implementation-progress.md) |
| Rastreabilidade PRD → implementação → evidência | `partial_through_task_10` | [requirements-traceability.md](requirements-traceability.md) |
| Registro de riscos | `active` | [risk-register.md](risk-register.md) |
| LGPD, minimização e retenção | `implemented_pending_vps_validation` | [lgpd-retention.md](lgpd-retention.md) |
| SLO e observabilidade | `proposed_pending_measurement` | [slo.md](slo.md) |
| Operação e deploy | `prepared_not_executed` | [runbook.md](runbook.md) |
| Rollback | `prepared_not_executed` | [rollback.md](rollback.md) |
| Evidência local/nativa | `partial_through_task_10` | [local-validation.md](local-validation.md) |
| Deploy Supabase do app | `not_executed` | [supabase-deployment.md](supabase-deployment.md) |
| Validação VPS | `pending_user_execution` | [vps-validation.md](vps-validation.md) |
| Continuidade entre sessões/computadores | `current_through_task_10` | [continuation-handoff.md](continuation-handoff.md) |

## Governança da execução

- toda a Fase 2 será desenvolvida diretamente na branch canônica `main`, por autorização explícita do usuário;
- o agente pode criar commits locais pequenos depois dos respectivos testes e gates;
- o agente não executará `git push`; a publicação no GitHub será feita manualmente pelo usuário;
- depois do fechamento interno dos checks nativos, revisão das migrations, backup e dry-run, o agente está autorizado a aplicar as migrations no Supabase do app e executar a validação remota correspondente;
- nenhuma migration, escrita ou deploy será realizado no Supabase do RAG;
- o deploy na VPS Linux continuará sendo executado exclusivamente pelo usuário depois do fechamento das Tasks 1–15;
- após o deploy VPS, o agente conduzirá a inspeção de Compose/logs e fornecerá os testes manuais por papel necessários para o aceite final;
- este computador não usará Docker Desktop, WSL ou Podman; nenhuma instalação desses runtimes será tentada;
- testes dependentes de PostgreSQL/Supabase local, imagens Linux, Compose, restart e persistência serão preparados agora e executados na VPS depois do fechamento interno das Tasks 1–15;
- uma task com teste dependente de Docker pode avançar somente como `implemented_pending_vps_validation`; ela não recebe aceite final até a evidência VPS correspondente;
- o fechamento interno usa o subestado `implementation_complete_pending_vps_validation`, ainda pertencente ao estado oficial `in_progress`.

## Gate de entrada reconciliado

| Dependência ou risco herdado | Estado para a Fase 2 | Tratamento |
|---|---|---|
| Fase 0 | `production_validated` | ADRs 0001–0005 permanecem vinculantes |
| Fase 1 | `production_validated` | domínio, RLS/RBAC, REST/MCP, auditoria, idempotência e confirmação conversacional são baseline de regressão |
| Limpeza Supabase F1-003 | `deployed_and_validated` para baseline/quarentena; limpeza destrutiva `planned_not_applied` | não misturar limpeza de legado às migrations da Fase 2 |
| Supabase do RAG | separado e somente leitura | nenhuma migration ou mutação; apenas consultas MCP de referências oficiais |
| Feature flags | default-off e kill switch preservados | habilitar read/write somente no rollout controlado da Task 14 |
| Warnings de advisors | 15 warnings de segurança documentados na Fase 1; 81 warnings no advisor `--type all` da Fase 2 | contagens usam escopos diferentes; exigir zero erro e zero achado novo nos objetos alterados |
| Bundle frontend F1-201 | dívida transferida para a Fase 2 | usar lazy loading nas novas rotas e medir no gate da Task 14, sem refatoração ampla fora do workspace |
| Runtime local deste computador | portas `55320–55329` versionadas; Docker CLI/Desktop, Podman e WSL ausentes; uso local desses runtimes descartado pelo usuário | executar testes nativos no Windows e diferir os gates de banco/Linux para a VPS |

**Commit de retomada:** `6819aa7`. O estado das flags continua default-off conforme `apps/chat-web/src/lib/marketingOps/flags.ts` e sua regressão existente.

## Progresso do plano

| Task | Entregável | Estado |
|---:|---|---|
| 1 | Gate de entrada e contrato aprovado | `completed_reviewed` |
| 2 | Schema do agregado, RLS, materiais e concorrência | `implemented_pending_vps_validation` |
| 3 | Contratos e máquina de estados no serviço | `completed_reviewed` |
| 4 | CRUD, busca e concorrência do agregado | `implemented_pending_vps_validation` |
| 5 | Participantes e perfis | `implemented_pending_vps_validation` |
| 6 | Materiais e Artifact Server | `implemented_pending_vps_validation` |
| 7 | Referências oficiais do RAG | `implemented_pending_vps_validation` |
| 8 | Timeline segura | `implemented_pending_vps_validation` |
| 9 | REST v1 e OpenAPI | `implemented_pending_vps_validation` |
| 10 | Cliente frontend tipado | `implemented_pending_vps_validation` |
| 11 | Lista, filtros e criação | `not_started` |
| 12 | Workspace e conflitos | `not_started` |
| 13 | Participantes, materiais e timeline na UI | `not_started` |
| 14 | Observabilidade, Compose, E2E e documentação | `not_started` |
| 15 | Revisão, integração e handoff VPS | `not_started` |

Detalhes de commits, evidências e pendências por task ficam em [implementation-progress.md](implementation-progress.md). A tabela acima é o resumo executivo e deve ser atualizada no mesmo commit documental de cada task.

## Regras de retomada

- trabalhar somente em `main`, conforme decisão explícita do usuário;
- ler integralmente [continuation-handoff.md](continuation-handoff.md) antes de editar;
- manter testes antes da implementação; quando o teste exigir Docker/PostgreSQL real, registrar `execution_deferred_to_vps` e não alegar RED/GREEN até a execução na VPS;
- não promover as Tasks 2 e 4–10 a concluídas antes dos respectivos gates PostgreSQL/RLS/concorrência/integrações/client/API/Compose na VPS;
- não copiar secrets, `.env` ou chaves para documentação ou logs;
- não fazer deploy Supabase remoto antes do fechamento interno dos checks nativos, revisão das migrations, backup e dry-run;
- não fazer deploy VPS pelo agente; o usuário executará o runbook após o fechamento interno;
- ao terminar cada task, atualizar no mesmo ciclo `implementation-progress.md`, `local-validation.md`, `requirements-traceability.md` quando aplicável e `continuation-handoff.md`.
