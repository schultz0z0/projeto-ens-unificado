# Backlog priorizado — Fase 1

## Objetivo da fase

Entregar a fundação segura e observável do `marketing-ops`, sem construir ainda o workspace completo nem executar canais reais.

## Regras de entrada

- inventários, ADRs, glossário e responsabilidades da Fase 0 aceitos;
- nenhum `BLOCKER` abaixo pode ser ignorado por feature flag;
- ambiente de desenvolvimento separado da produção;
- push/deploy continuam sob responsabilidade do usuário.

## P0 — bloqueadores

| ID | Épico | Entrega/critério de aceite | Dependências | Owner proposto |
|---|---|---|---|---|
| F1-001 | Ambientes | provisionar Supabase dev/preview; identificar inequivocamente dev/prod; testes nunca mutam prod | acesso Supabase | DevOps/Data |
| F1-002 | Baseline de schema | reconciliar remoto, `ignored_migrations` e cadeia oficial; bootstrap do zero reproduzível | F1-001 | Backend/Data |
| F1-003 | Limpeza Supabase app | backup; remover/quarentenar legado conforme `supabase-cleanup-plan.md`; não tocar RAG MCP | F1-001/002 | Backend/Data |
| F1-004 | Hardening do Bridge | remover tenant de `user_metadata`; fail-closed; env obrigatório em produção; testes negativos | nenhum | Plataforma/Security |
| F1-005 | Scaffold de serviço | `services/marketing-ops`, Dockerfile, config, health/readiness, graceful shutdown, Compose interno | nenhum | Backend/DevOps |
| F1-006 | Identidade e membership | modelo tenant/membro/papel; ator confiável; nenhuma authority do cliente | F1-001/002 | Backend/Security |
| F1-007 | Delegação Hermes | emissor/verificador assinado, scopes, audience, TTL, correlação e rotação | F1-004/006 | Plataforma/Security |
| F1-008 | Schema mínimo | tenants/memberships, campaigns draft, items, audit_events, idempotency_records e outbox | F1-002/006 | Backend/Data |
| F1-009 | RLS e grants | RLS default-deny, grants explícitos, policies por tenant/papel, suíte cross-tenant | F1-008 | Backend/Security |
| F1-010 | Contrato API | OpenAPI versionado para health, campaign/item draft e auditoria; erros estáveis | F1-005/008/009 | Backend |
| F1-011 | Contrato MCP | tools versionadas; leitura e draft; mutações exigem delegação/idempotência | F1-007/010 | AI/Backend |
| F1-012 | Auditoria/idempotência/outbox | transação única, retries sem duplicação, actor/tenant/correlation ID | F1-008 | Backend |
| F1-013 | Observabilidade | logs JSON, request/run/correlation IDs, métricas de latência/erro/negação/outbox | F1-005/010/011 | Plataforma |
| F1-014 | Gate e rollback | testes unitários/integração/contrato/RLS, migration clean+upgrade, backup/restore e VPS | todos | QA/DevOps |

## P1 — necessário antes do Workspace MVP

| ID | Item | Critério de aceite | Owner proposto |
|---|---|---|---|
| F1-101 | SDK/client frontend | client tipado, refresh token, erros e correlation ID | Frontend |
| F1-102 | Feature flags | flags server/client com default off e teste de kill switch | Plataforma/Frontend |
| F1-103 | Concorrência otimista | `version`/ETag; conflito retorna erro tratável | Backend |
| F1-104 | Paginação/filtros | curso, status, owner, período; limites e índices | Backend/Data |
| F1-105 | Deep links chat -> operação | contrato de URL/ID sem duplicar estado em mensagem | Frontend/Bridge |
| F1-106 | Retenção e LGPD | matriz por dado, exportação/exclusão e auditabilidade | Produto/Compliance |
| F1-107 | Supply chain frontend | resolver 14 altas/6 moderadas com regressão e lockfile | Frontend/Security |
| F1-108 | Runbooks/SLO | backup, restore, incidentes, secrets e owner de plantão | DevOps |

## P2 — melhorias que não bloqueiam a fundação

| ID | Item | Fase provável | Owner proposto |
|---|---|---|---|
| F1-201 | code splitting e budget do frontend | 2 | Frontend |
| F1-202 | desativar Edge Function `proxy-chatbot` legada | 1–2 | Plataforma |
| F1-203 | política de promoção RAG/Graph | 4/7 | Knowledge |
| F1-204 | dashboards operacionais avançados | 7 | Data/Product |

## Decisões abertas

| ID | Decisão aberta | Default até decisão | Owner |
|---|---|---|---|
| D-01 | formato de assinatura/delegação | MCP write desligado | Plataforma/Security |
| D-02 | owner definitivo de catálogo ENS | somente leitura via RAG | Produto |
| D-03 | retenção de chat/artefatos | preservar, acesso restrito | Compliance/Produto |
| D-04 | importação do RAG marketing antigo | quarentena; não escrever no RAG MCP | Marketing/Knowledge |

## Definition of Done da Fase 1

- P0 concluído;
- migrations clean e upgrade aprovadas em dev isolado;
- zero acesso cross-tenant nos testes negativos;
- delegação expirada/forjada/fora de audiência rejeitada;
- retries não duplicam entidades ou outbox;
- RLS e grants revisados com advisors;
- API/MCP e observabilidade documentados;
- backup/restore e rollback testados;
- gate local aprovado;
- deploy pelo usuário e gate VPS aprovados.
