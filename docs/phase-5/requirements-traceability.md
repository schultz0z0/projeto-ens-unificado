# Rastreabilidade de requisitos — Fase 5

- **Estado:** `implemented_local_validated`
- **Revisão:** 2026-08-05
- **Implementação:** concluída; produção pendente

## Matriz requisito → implementação → evidência

| Requisito | Entrega | Evidência | Estado |
|---|---|---|---|
| F5-RF-01 Solicitação editorial | alvo `assetId + versionNumber` congelado | domínio, REST, SDK, UI e smoke remoto | `implemented` |
| F5-RF-02 Solicitação operacional | action package canônico/imutável | hash, triggers, domínio e UI | `implemented` |
| F5-RF-03 Fila | filtros, cursor, risco, status e campanha | REST/SDK/UI/E2E | `implemented` |
| F5-RF-04 Decisão | uma decisão humana efetiva | lock, ETag, unique, UI e smoke | `implemented` |
| F5-RF-05 Segregação | RBAC e autoaprovação operacional negada | grants/RLS/domínio/Bridge | `implemented` |
| F5-RF-06 Expiração | decisão tardia negada e pacote invalidado | domínio/teste/smoke | `implemented` |
| F5-RF-07 Alteração | alvo divergente invalida; novo ciclo referencia anterior | domínio e constraints | `implemented` |
| F5-RF-08 Ajustes | `changes_requested`/`rejected` exigem comentário | schemas, UI e testes | `implemented` |
| F5-RF-09 Action package | payload, hash, status e autorização | migrations/domínio/testes | `implemented` |
| F5-RF-10 Notificações | review/status com payload mínimo e deep link | domínio/UI/testes | `implemented` |
| F5-RF-11 Hermes | prepara/submete após confirmação; nunca decide | MCP/executor/skill/Bridge | `implemented` |
| F5-RF-12 Histórico | request + decisão + auditoria/outbox append-only | detalhe/UI/smoke | `implemented` |

## Gates transversais

| Gate | Evidência | Estado |
|---|---|---|
| RLS/RBAC/cross-tenant | catálogo e smoke Supabase remoto | `passed` |
| Imutabilidade/hash | triggers, grants, canonical hash e smoke | `passed` |
| Idempotência/concorrência | domínio, unique/lock e decisão remota | `passed` |
| Auditoria/outbox | gravação atômica e testes dirigidos | `passed` |
| Acessibilidade/responsividade | axe crítico + Chromium desktop/mobile | `passed_local` |
| Observabilidade/redaction | métrica allowlisted e logger redigido | `passed` |
| Hermes sem decisão | contratos, executor, skill e scopes | `passed` |
| Migration/rollback | 7 migrations remotas aditivas e forward-fix | `passed` |
| Gate local | suites, builds, typechecks, audit e security gate | `passed` |
| Gate VPS/navegador | aguarda deploy do responsável | `pending` |

## Critério de fechamento

Não há divergência conhecida entre PRD, design, migrations, REST/OpenAPI, MCP
e frontend. A matriz só muda para `closed` após a homologação real descrita em
`vps-validation.md`.
