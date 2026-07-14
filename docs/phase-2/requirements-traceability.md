# Rastreabilidade da Fase 2

- **Estado:** `partial_through_task_10`
- **Data da revisão:** 2026-07-14
- **Fonte:** [PRD da Fase 2](../prds/phase-2-workspace-operacional-mvp.md)
- **Plano:** [plano de implementação](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Exclusão confirmada:** nenhuma migration, escrita ou conexão direta ao Supabase do RAG

## Requisitos funcionais

| Requisito | Banco e backend | API e UI | Evidência atual | Estado |
|---|---|---|---|---|
| F2-RF-01 Lista | projeção resumida, cursor estável e autorização em `domain/campaigns.ts` | rota/OpenAPI/client tipado completos; tabela/cards são Task 11 | contrato de filtros/página coberto; SQL e integração real diferidos | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-02 Busca e filtros | busca limitada a nome/título de referência; status, referência, canal, responsável e período | query REST e client completos; URL/reset são Task 11 | parser e serialização do client verdes; DB/performance diferidos | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-03 Criação | rascunho name-only, owner inicial, idempotência, audit e outbox | `POST /v1/campaigns` e client progressivo com idempotência; diálogo é Task 11 | adapter/client verdes; integração PostgreSQL coletada | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-04 Dados da campanha | migration `20260714020344`, schemas estritos, referência canônica e patch progressivo | detalhe/patch/client completos; formulário é Task 12 | Tasks 2–4, 7, 9–10; persistência real diferida | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-05 Workspace | agregado e seções sob demanda possuem suporte de domínio | REST e client de detalhe, participantes, materiais e timeline fechados; composição visual é Tasks 11–13 | query keys isolam recursos; integração real/UI pendentes | `backend_and_client_ready_ui_not_started` |
| F2-RF-06 Transições | matriz `draft → planned → active → completed → archived`, reabertura controlada e archive terminal | transition/archive e client separados, com ETag/`If-Match`; controles são Task 12 | contratos nativos verdes; integração PostgreSQL coletada | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-07 Participantes | exatamente um owner principal, papéis e locks no agregado | rotas/OpenAPI/client completos; painel é Task 13 | mutações tipadas com versão/idempotência; 5 cenários DB diferidos | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-08 Materiais | metadata no Marketing Ops, bytes no Artifact Server, ownership, 25 MiB e unlink lógico | client envia `File` bruto e cobre upload/link/access/unlink; painel é Task 13 | headers/corpo binário verdes; integração real/Compose diferidos | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-09 Timeline | função privada e domínio expõem somente ação allowlisted, ator exibível, timestamp, origem, campos allowlisted e correlação | rota/OpenAPI/client paginado completos; UI é Task 13 | 7 testes backend e contrato client verdes; pgTAP/UI diferidos | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-10 Edição concorrente | versão do agregado, `If-Match`, lock e `version_conflict` | client preserva patch local e expõe `currentVersion`; diálogo é Task 12 | 409/headers/ETag verdes; concorrência real e UX diferidas | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-11 Exclusão | hard delete não exposto; `archived` terminal e read-only | rota e client de archive existem; confirmação visual é Task 12 | contratos de estado/client e cenários DB coletados | `backend_and_client_implemented_ui_pending_vps_validation` |
| F2-RF-12 Deep links | campanha possui UUID estável e detalhe por ID | rota frontend `/marketing-ops/campaigns/:campaignId` é Task 12 | não há E2E/frontend ainda | `backend_ready_frontend_not_started` |

## Critérios de aceite do PRD

| Critério | Task principal | Estado/evidência |
|---|---:|---|
| Usuário autorizado cria rascunho | 4, 11 | backend implementado; UI/E2E/VPS pendentes |
| Campos obrigatórios e datas são validados | 2, 3, 12 | contratos nativos verdes; banco/UI pendentes |
| Campanha não ativa sem responsável e dados mínimos | 2, 3, 4 | domínio implementado; PostgreSQL real pendente |
| Lista pagina, busca e combina filtros | 4, 11 | backend implementado; DB/performance/UI pendentes |
| URL preserva filtros relevantes | 11 | `not_started` |
| Workspace mostra visão, briefing, participantes, materiais e atividade | 12, 13 | backend das seções e timeline implementado; UI pendente |
| Upload/vínculo respeita ownership e limites | 6, 13 | contratos nativos verdes; integração real/UI pendentes |
| Conflito não sobrescreve dados | 2, 4, 10, 12 | client expõe `currentVersion` sem alterar patch local; harness real e diálogo pendentes |
| Member, manager e admin respeitam a matriz | 2, 4, 5, 14 | checks nativos parciais; RLS/E2E/VPS pendentes |
| Arquivamento preserva histórico | 2, 4, 8 | archive e projeção histórica implementados; PostgreSQL/UI/VPS pendentes |
| Timeline não expõe campos proibidos | 8, 13 | `implemented_pending_vps_validation`; 7 testes nativos verdes, pgTAP/UI/logs VPS pendentes |
| Estados de erro e vazio estão implementados | 9, 11–13 | envelope/códigos REST implementados; UI `not_started` |
| Jornadas críticas são responsivas e acessíveis | 11–14 | `not_started` |

## Gates transversais

| Gate | Evidência exigida | Estado |
|---|---|---|
| Segurança e isolamento | pgTAP/RLS três papéis, cross-tenant, mass assignment e logs redigidos | `partially_implemented_deferred_to_vps` |
| Concorrência | harness campanha/participante/item e conflito de versão sem perda | `prepared_deferred_to_vps` |
| Artifact Server | build Linux, health, ownership, upload/access/unlink, restart e persistência | `prepared_deferred_to_vps` |
| RAG | chamada MCP real read-only, indisponibilidade e logs sem payload | `prepared_deferred_to_vps` |
| Frontend | unitários, integração, Playwright desktop/mobile e axe | `not_started` |
| Performance | 5.000 campanhas e primeira página p95 <= 500 ms | `not_started` |
| Supabase do app | backup, dry-run, migrations, lint/advisors e invariantes | `not_executed` |
| VPS | Compose, TLS/CORS/auth, smokes, logs, restart, persistência e rollback | `pending_user_execution` |

## Evidências agregadas

- [Progresso por task](implementation-progress.md)
- [Validação local e nativa](local-validation.md)
- [Deploy Supabase](supabase-deployment.md)
- [Validação VPS](vps-validation.md)
- [Riscos](risk-register.md)
- [LGPD e retenção](lgpd-retention.md)

Nenhum requisito está `production_validated`. O fechamento de backend até a Task 9 e do client tipado na Task 10 reduz o trabalho restante, mas não substitui UI, banco real, integrações, deploy ou aceite do piloto.
