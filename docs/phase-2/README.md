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
- não iniciar a Task 3 enquanto a Task 2 tiver `changes_requested`;
- manter TDD: reproduzir RED, implementar, obter GREEN e passar por revisão independente;
- não copiar secrets, `.env` ou chaves para documentação ou logs;
- não fazer deploy Supabase remoto até a Fase 2 completa passar pelos gates locais;
- não fazer deploy VPS pelo agente; o usuário executará o runbook após o fechamento interno.
