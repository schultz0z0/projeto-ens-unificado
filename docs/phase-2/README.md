# Fase 2 — Workspace Operacional MVP

Este diretório reúne o design aprovado, o estado de execução, as evidências locais e o handoff da Fase 2. A documentação segue a separação usada nas Fases 0 e 1 entre implementação local, prontidão para deploy e validação de produção.

## Status

- **Fase:** `paused_handoff_ready`
- **Data do snapshot:** 2026-07-14
- **Branch canônica:** `main`
- **Base de produção:** Fase 1 `production_validated`
- **Implementação:** Task 1 concluída; Task 2 implementada e testada, porém com `changes_requested`; Tasks 3–15 não iniciadas
- **Deploy Supabase remoto:** não executado
- **Deploy VPS:** não executado
- **PRD:** [phase-2-workspace-operacional-mvp.md](../prds/phase-2-workspace-operacional-mvp.md)
- **Design técnico:** [design.md](design.md)
- **Plano:** [2026-07-13-phase-2-workspace-operacional-mvp-implementation.md](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Continuação obrigatória:** [continuation-handoff.md](continuation-handoff.md)
- **Evidência local atual:** [local-validation.md](local-validation.md)

O desenvolvimento foi pausado durante a revisão independente de aceite da Task 2. O código em `main` contém a implementação e seus testes, mas a Task 2 **não deve ser considerada concluída**: um probe independente reproduziu deadlock `40P01` no caminho concorrente de `campaign_items`. A correção deve ser feita e revisada antes da Task 3.

## Governança da execução

- toda a Fase 2 será desenvolvida diretamente na branch canônica `main`, por autorização explícita do usuário;
- o agente pode criar commits locais pequenos depois dos respectivos testes e gates;
- o agente não executará `git push`; a publicação no GitHub será feita manualmente pelo usuário;
- depois do fechamento interno dos checks nativos, revisão das migrations, backup e dry-run, o agente está autorizado a aplicar as migrations no Supabase do app e executar a validação remota correspondente;
- nenhuma migration, escrita ou deploy será realizado no Supabase do RAG;
- o deploy na VPS Linux continuará sendo executado exclusivamente pelo usuário depois do fechamento das Tasks 1–15;
- após o deploy VPS, o agente conduzirá a inspeção de Compose/logs e fornecerá os testes manuais por papel necessários para o aceite final.
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
| 2 | Schema do agregado, RLS, materiais e concorrência | `changes_requested` |
| 3 | Contratos e máquina de estados no serviço | `not_started` |
| 4 | CRUD, busca e concorrência do agregado | `not_started` |
| 5 | Participantes e perfis | `not_started` |
| 6 | Materiais e Artifact Server | `not_started` |
| 7 | Referências oficiais do RAG | `not_started` |
| 8 | Timeline segura | `not_started` |
| 9 | REST v1 e OpenAPI | `not_started` |
| 10 | Cliente frontend tipado | `not_started` |
| 11 | Lista, filtros e criação | `not_started` |
| 12 | Workspace e conflitos | `not_started` |
| 13 | Participantes, materiais e timeline na UI | `not_started` |
| 14 | Observabilidade, Compose, E2E e documentação | `not_started` |
| 15 | Revisão, integração e handoff VPS | `not_started` |

## Regras de retomada

- trabalhar somente em `main`, conforme decisão explícita do usuário;
- ler integralmente [continuation-handoff.md](continuation-handoff.md) antes de editar;
- manter testes antes da implementação; quando o teste exigir Docker/PostgreSQL real, registrar `execution_deferred_to_vps` e não alegar RED/GREEN até a execução na VPS;
- não iniciar a Task 3 enquanto a Task 2 não tiver ao menos `implemented_pending_vps_validation`, revisão estática independente e todos os checks nativos disponíveis aprovados;
- não copiar secrets, `.env` ou chaves para documentação ou logs;
- não fazer deploy Supabase remoto antes do fechamento interno dos checks nativos, revisão das migrations, backup e dry-run;
- não fazer deploy VPS pelo agente; o usuário executará o runbook após o fechamento interno.
