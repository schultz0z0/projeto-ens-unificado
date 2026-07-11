# Fase 1 — Fundação do Marketing Ops

Este diretório reúne design, execução, validações e operação da Fase 1. O histórico da fase deve distinguir implementação local, prontidão para produção e homologação VPS conforme o ADR 0005.

## Status

- **Fase:** `in_progress`
- **Início:** 2026-07-11
- **Branch:** `codex/phase-1-marketing-ops`
- **Dependência:** Fase 0 `production_validated`
- **PRD:** [phase-1-fundacao-marketing-ops.md](../prds/phase-1-fundacao-marketing-ops.md)
- **Design técnico:** [design.md](design.md)
- **Plano:** [2026-07-11-phase-1-marketing-ops-implementation.md](../plans/2026-07-11-phase-1-marketing-ops-implementation.md)

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
| Schema, RLS, grants e pgTAP | `validated_locally` (90 testes de banco) |
| Serviço, API e MCP | `pending` |
| Hardening da Bridge e delegação Hermes | `pending` |
| SDK frontend e feature flags | `pending` |
| Compose, observabilidade e runbooks | `pending` |
| Gate local | `pending` |
| Gate VPS | `pending_user_deploy` |

## Regras de evidência

- secrets e valores do `.env` não entram em logs, documentos ou diffs;
- testes remotos são somente leitura até existir backup, migration aprovada e ação explícita de deploy;
- cada critério do PRD deve apontar para teste, comando ou evidência operacional;
- `ready_for_production` exige gate local completo;
- `production_validated`/`completed` exige deploy e gate VPS.
