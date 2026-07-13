# Fase 1 — Fundação do Marketing Ops

Este diretório reúne design, execução, validações e operação da Fase 1. O histórico da fase deve distinguir implementação local, prontidão para produção e homologação VPS conforme o ADR 0005.

## Status

- **Fase:** `production_validated`
- **Início:** 2026-07-11
- **Branch:** `main`
- **Dependência:** Fase 0 `production_validated`
- **PRD:** [phase-1-fundacao-marketing-ops.md](../prds/phase-1-fundacao-marketing-ops.md)
- **Design técnico:** [design.md](design.md)
- **Design do hardening conversacional:** [conversational-confirmation-design.md](conversational-confirmation-design.md)
- **Plano:** [2026-07-11-phase-1-marketing-ops-implementation.md](../plans/2026-07-11-phase-1-marketing-ops-implementation.md)
- **Plano do hardening:** [2026-07-13-phase-1-marketing-ops-conversational-confirmation.md](../plans/2026-07-13-phase-1-marketing-ops-conversational-confirmation.md)

O gate local e a homologação no app de produção foram concluídos. A rodada final comprovou com os três papéis o RBAC e o isolamento de tenant; com `admin`, o plano revisado permaneceu sem mutação até `Confirmo o plano revisado.`, executou exatamente uma alteração, persistiu a versão 2 e gerou o evento de auditoria esperado. Probes, métricas protegidas e circuit breaker permaneceram saudáveis. A Fase 1 foi concluída em 13 de julho de 2026.

## Contrato de ambientes

- o `.env` da raiz é a fonte global de configuração do monorepo;
- o `marketing-ops` usa exclusivamente o Supabase do app, identificado por `NEXUS_APP_SUPABASE_*` e pela URL PostgreSQL operacional correspondente;
- o frontend continua usando apenas URL e chave pública do Supabase do app;
- o `rag-mcp` continua usando exclusivamente `NEXUS_RAG_SUPABASE_*`;
- nenhuma migration, consulta ou teste do Marketing Ops aponta para o Supabase do RAG;
- o ambiente local Supabase é descartável e identificado como desenvolvimento;
- produção não é mutada por testes locais.

## Entregáveis rastreados

| Entregável | Estado inicial |
|---|---|
| Baseline e ambiente Supabase local | `validated_locally` ([evidência](supabase-baseline.md)) |
| Supabase do app em produção | `deployed_and_validated` ([evidência](supabase-deployment.md)) |
| Schema, RLS, grants e pgTAP | `validated_locally` (97 testes de banco) |
| Serviço, API e MCP | `validated_locally` (53 testes, incluindo 2 E2E de container) |
| Hardening da Bridge e delegação Hermes | `production_validated` (Bridge 69, Hermes 15 e imagem Linux 19/19; token do turno e plano vinculados deterministicamente no executor) |
| Confirmação conversacional de mutações | `production_validated` (plano revisado sem persistência, confirmação única posterior, execução exata e auditoria comprovadas no app real) |
| SDK frontend e feature flags | `validated_locally` (125 testes frontend) |
| Compose, observabilidade e runbooks | `validated_locally` |
| Gate local | `validated_locally` ([evidência](local-validation.md)) |
| Gate VPS | `production_validated` ([evidência](vps-validation.md)) |

Rastreabilidade requisito a requisito: [requirements-traceability.md](requirements-traceability.md). Riscos residuais: [risk-register.md](risk-register.md). Checklist de produção: [vps-validation.md](vps-validation.md).

## Regras de evidência

- secrets e valores do `.env` não entram em logs, documentos ou diffs;
- testes remotos são somente leitura até existir backup, migration aprovada e ação explícita de deploy;
- cada critério do PRD deve apontar para teste, comando ou evidência operacional;
- `ready_for_production` exige gate local completo;
- `production_validated`/`completed` exige deploy e gate VPS.
