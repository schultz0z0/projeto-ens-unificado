# Handoff de continuação — Fase 3

- **Estado:** `ready_to_start_task_6`
- **Branch única:** `main`
- **Snapshot:** 2026-07-18
- **Código/schema Fase 3:** Tasks 1–5 validadas localmente (50%)

## Ordem de leitura

1. [PRD](../prds/phase-3-calendario-esteira-producao.md);
2. [design](design.md);
3. [plano](../plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md);
4. [rastreabilidade](requirements-traceability.md);
5. [riscos](risk-register.md);
6. [progresso](implementation-progress.md).

## Ponto de continuação

Começar pela Task 6 do plano:

- escrever REDs do inventário REST/OpenAPI e do client frontend;
- expor itens, agenda, dependências, conteúdo, versões e artifacts sem duplicar
  regra de domínio nos adapters;
- preservar autenticação, correlação, ETag, `Idempotency-Key`, `If-Match` e
  `currentVersion`;
- manter notificações/lote como domínio da Task 9, sem antecipar semântica.

## Último gate confirmado

- 320/320 pgTAP, lint vazio e diff vazio após reset;
- 166/166 testes do Marketing Ops e 8/8 do Artifact Server;
- typecheck/build verdes;
- imagens Docker de Marketing Ops/Artifact Server construídas;
- smoke real de upload, ownership, URL assinada, download e cleanup passou.

## Pré-condição de deploy futuro

O índice
`20260718183937_add_campaign_list_tenant_updated_index.sql` da Fase 2 está
validado localmente, mas pendente no remoto. Ele não bloqueia desenvolvimento
local, porém deve integrar o próximo dry-run/push antes da homologação VPS da
Fase 3.

## Regras

- somente `main`;
- TDD e commits locais pequenos;
- sem push pelo agente;
- Supabase remoto apenas após gate local, backup e dry-run;
- VPS executada pelo usuário;
- nenhum estado `approved/scheduled/executing/failed` na API da Fase 3;
- nenhuma recorrência, drag obrigatório ou notificação externa.
