# Rastreabilidade da Fase 2

- **Estado:** `partial_through_task_7`
- **Data da revisão:** 2026-07-14
- **Fonte:** [PRD da Fase 2](../prds/phase-2-workspace-operacional-mvp.md)
- **Plano:** [plano de implementação](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Exclusão confirmada:** nenhuma migration, escrita ou conexão direta ao Supabase do RAG

## Requisitos funcionais

| Requisito | Banco e backend | API e UI | Evidência atual | Estado |
|---|---|---|---|---|
| F2-RF-01 Lista | projeção resumida, cursor estável e autorização em `domain/campaigns.ts` | rota backend existe; tabela/cards são Task 11 | 37 testes nativos da Task 4; SQL real diferido | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-02 Busca e filtros | busca limitada a nome/título de referência; status, referência, canal, responsável e período | query REST implementada; sincronização/reset por URL são Task 11 | contratos de filtro/cursor verdes; DB/performance diferidos | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-03 Criação | rascunho name-only, owner inicial, idempotência, audit e outbox | `POST /v1/campaigns` existe; diálogo é Task 11 | testes nativos e cenários PostgreSQL coletados | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-04 Dados da campanha | migration `20260714020344`, schemas estritos, referência canônica e patch progressivo | detalhe/patch backend existem; formulário é Task 12 | Tasks 2–4 e 7; persistência real diferida | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-05 Workspace | agregado e seções sob demanda possuem suporte de domínio | rota e composição visual são Tasks 11–13 | sem evidência frontend ainda | `not_started_frontend` |
| F2-RF-06 Transições | matriz `draft → planned → active → completed → archived`, reabertura controlada e archive terminal | rotas de transição/archive existem; controles são Task 12 | 13 contratos da Task 3 e testes nativos da Task 4 | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-07 Participantes | exatamente um owner principal, papéis e locks no agregado | rotas de candidatos/lista/mutação existem; painel é Task 13 | 39 checks nativos e 5 cenários DB coletados | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-08 Materiais | metadata no Marketing Ops, bytes no Artifact Server, ownership, 25 MiB e unlink lógico | rotas de upload/link/access/unlink existem; painel é Task 13 | 16 checks nativos e 3 cenários DB; Compose real diferido | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-09 Timeline | contrato aprovado exige projeção minimizada sobre auditoria | domínio/rota/UI são Tasks 8 e 13 | ainda sem teste ou implementação | `not_started` |
| F2-RF-10 Edição concorrente | versão do agregado, `If-Match`, lock e `version_conflict` | backend retorna conflito; UX de preservar/reaplicar é Tasks 10 e 12 | harness ampliado e testes nativos; concorrência real diferida | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-11 Exclusão | hard delete não exposto; `archived` terminal e read-only | rota de archive existe; confirmação visual é Task 12 | contratos de estado e cenários DB coletados | `backend_implemented_ui_pending_vps_validation` |
| F2-RF-12 Deep links | campanha possui UUID estável e detalhe por ID | rota frontend `/marketing-ops/campaigns/:campaignId` é Task 12 | não há E2E/frontend ainda | `backend_ready_frontend_not_started` |

## Critérios de aceite do PRD

| Critério | Task principal | Estado/evidência |
|---|---:|---|
| Usuário autorizado cria rascunho | 4, 11 | backend implementado; UI/E2E/VPS pendentes |
| Campos obrigatórios e datas são validados | 2, 3, 12 | contratos nativos verdes; banco/UI pendentes |
| Campanha não ativa sem responsável e dados mínimos | 2, 3, 4 | domínio implementado; PostgreSQL real pendente |
| Lista pagina, busca e combina filtros | 4, 11 | backend implementado; DB/performance/UI pendentes |
| URL preserva filtros relevantes | 11 | `not_started` |
| Workspace mostra visão, briefing, participantes, materiais e atividade | 12, 13 | backend parcial; UI/timeline pendentes |
| Upload/vínculo respeita ownership e limites | 6, 13 | contratos nativos verdes; integração real/UI pendentes |
| Conflito não sobrescreve dados | 2, 4, 10, 12 | backend implementado; harness real e UX pendentes |
| Member, manager e admin respeitam a matriz | 2, 4, 5, 14 | checks nativos parciais; RLS/E2E/VPS pendentes |
| Arquivamento preserva histórico | 2, 4, 8 | archive implementado; auditoria/timeline real pendentes |
| Timeline não expõe campos proibidos | 8, 13 | `not_started`; bloqueador antes do rollout |
| Estados de erro e vazio estão implementados | 11–13 | `not_started` |
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

Nenhum requisito está `production_validated`. O fechamento de backend até a Task 7 reduz o trabalho restante, mas não substitui UI, banco real, integrações, deploy ou aceite do piloto.
