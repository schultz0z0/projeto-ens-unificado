# Rastreabilidade da Fase 2

- **Estado:** `partial_through_task_13`
- **Data da revisão:** 2026-07-14
- **Fonte:** [PRD da Fase 2](../prds/phase-2-workspace-operacional-mvp.md)
- **Plano:** [plano de implementação](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Exclusão confirmada:** nenhuma migration, escrita ou conexão direta ao Supabase do RAG

## Requisitos funcionais

| Requisito | Banco e backend | API e UI | Evidência atual | Estado |
|---|---|---|---|---|
| F2-RF-01 Lista | projeção resumida com owners/alertas, cursor estável e autorização | rota/OpenAPI/client, tabela desktop e cards mobile completos | 5 testes de jornada, QA Chrome e contrato de filtros/página; SQL/API real diferidos | `implemented_pending_vps_validation` |
| F2-RF-02 Busca e filtros | busca limitada a nome/título; status, referência, canal, responsável e período | filtros combináveis/resetáveis com estado na URL | serialização, debounce e URL verdes; DB/performance/API real diferidos | `implemented_pending_vps_validation` |
| F2-RF-03 Criação | rascunho name-only, owner inicial, idempotência, audit e outbox | diálogo acessível cria e navega ao deep link | nome preservado no erro e limpo no cancelamento; integração PostgreSQL/API real diferida | `implemented_pending_vps_validation` |
| F2-RF-04 Dados da campanha | migration `20260714020344`, schemas estritos, referência canônica e patch progressivo | detalhe/patch/client e formulário explícito completos | validação de campos/save em 6 testes e browser; persistência real diferida | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-05 Workspace | agregado e seções sob demanda possuem suporte de domínio | visão geral, briefing, participantes, materiais e atividade implementados | 22 testes focados e QA responsivo; integração API/PostgreSQL/E2E real pendente | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-06 Transições | matriz `draft → planned → active → completed → archived`, reabertura controlada e archive terminal | controles de avanço/reabertura/archive usam versão e idempotência | testes nativos e browser verdes; integração PostgreSQL/API real coletada | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-07 Participantes | exatamente um owner principal, papéis e locks no agregado | painel lista/busca/adiciona/edita/remove conforme capability e mantém owner único no cache | testes nativos de papel/versão verdes; 5 cenários DB, RLS e E2E diferidos | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-08 Materiais | metadata no Marketing Ops, bytes no Artifact Server, ownership, 25 MiB e unlink lógico | UI cobre upload/link/access/unlink, bloqueia arquivo inválido antes da rede e não expõe URL assinada | testes nativos verdes; ownership, bytes, Compose/restart/persistência diferidos | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-09 Timeline | função privada e domínio expõem somente ação allowlisted, ator exibível, timestamp, origem, campos allowlisted e correlação | timeline semântica usa cursor, rótulos allowlisted, loading/vazio/erro/retry | testes frontend/backend verdes; pgTAP, paginação real e logs diferidos | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-10 Edição concorrente | versão do agregado, `If-Match`, lock e `version_conflict` | diálogo preserva/compara patch local e oferece descartar/reaplicar sobre versão fresca | 409 simulado exercitado em teste/browser; concorrência API/DB real diferida | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-11 Exclusão | hard delete não exposto; `archived` terminal e read-only | confirmação visual e modo read-only após archive implementados | contrato, teste e browser verdes; histórico PostgreSQL/VPS pendente | `backend_client_and_ui_implemented_pending_vps_validation` |
| F2-RF-12 Deep links | campanha possui UUID estável e detalhe por ID | rota lazy `/marketing-ops/campaigns/:campaignId` trata UUID inválido, 404 e 403 | navegação/renderização unitária e browser cobertas; E2E integrado pendente | `implemented_pending_vps_validation` |

## Critérios de aceite do PRD

| Critério | Task principal | Estado/evidência |
|---|---:|---|
| Usuário autorizado cria rascunho | 4, 11 | backend/client/UI implementados; auth/API/DB real e E2E VPS pendentes |
| Campos obrigatórios e datas são validados | 2, 3, 12 | contratos e UI nativos verdes; banco/API real pendentes |
| Campanha não ativa sem responsável e dados mínimos | 2, 3, 4 | domínio implementado; PostgreSQL real pendente |
| Lista pagina, busca e combina filtros | 4, 11 | backend/client/UI e cursor cobertos; DB/API/performance VPS pendentes |
| URL preserva filtros relevantes | 11 | implementado e verificado no browser; E2E integrado/VPS pendente |
| Workspace mostra visão, briefing, participantes, materiais e atividade | 12, 13 | UI completa e responsiva validada; integração API/PostgreSQL/E2E VPS pendente |
| Upload/vínculo respeita ownership e limites | 6, 13 | limites client-side e fluxo UI verdes; ownership, bytes e Compose reais pendentes |
| Conflito não sobrescreve dados | 2, 4, 10, 12 | diálogo mantém/compara valor local e reaplica explicitamente; concorrência API/DB real pendente |
| Member, manager e admin respeitam a matriz | 2, 4, 5, 13, 14 | UI fail-closed e checks nativos por papel; RLS/E2E/VPS pendentes |
| Arquivamento preserva histórico | 2, 4, 8, 12 | confirmação e read-only implementados; preservação PostgreSQL/timeline/VPS pendente |
| Timeline não expõe campos proibidos | 8, 13 | backend/client/UI usam allowlists; pgTAP, persistência e logs VPS pendentes |
| Estados de erro e vazio estão implementados | 9, 11–13 | lista, workspace e painéis cobrem loading/erro/403/404/retry; API real/E2E pendentes |
| Jornadas críticas são responsivas e acessíveis | 11–14 | lista/workspace/painéis validados por semântica e em 390/768/1440 px; axe e E2E integrado pendentes |

## Gates transversais

| Gate | Evidência exigida | Estado |
|---|---|---|
| Segurança e isolamento | pgTAP/RLS três papéis, cross-tenant, mass assignment e logs redigidos | `partially_implemented_deferred_to_vps` |
| Concorrência | harness campanha/participante/item e conflito de versão sem perda | `prepared_deferred_to_vps` |
| Artifact Server | build Linux, health, ownership, upload/access/unlink, restart e persistência | `prepared_deferred_to_vps` |
| RAG | chamada MCP real read-only, indisponibilidade e logs sem payload | `prepared_deferred_to_vps` |
| Frontend | unitários, integração, Playwright desktop/mobile e axe | `unit_and_browser_qa_through_task_13_pending_integrated_e2e` |
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

Nenhum requisito está `production_validated`. O fechamento de backend até a Task 9, do client tipado na Task 10, da lista/criação na Task 11 e do workspace completo nas Tasks 12–13 reduz o trabalho restante, mas não substitui banco real, integrações, E2E/axe, deploy ou aceite do piloto.
