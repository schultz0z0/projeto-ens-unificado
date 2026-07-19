# Handoff de continuação — Fase 3

- **Estado:** `ready_to_start_task_10`
- **Branch única:** `main`
- **Snapshot:** 2026-07-19
- **Código/schema Fase 3:** Tasks 1–9 validadas localmente (90%)

## Ordem de leitura

1. [PRD](../prds/phase-3-calendario-esteira-producao.md);
2. [design](design.md);
3. [plano](../plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md);
4. [rastreabilidade](requirements-traceability.md);
5. [riscos](risk-register.md);
6. [progresso](implementation-progress.md).

## Ponto de continuação

Começar pela Task 10 do plano:

- ampliar o E2E para fluxo completo, perfis e persistência após restart;
- fechar métricas/logs allowlisted e readiness operacional;
- criar o gate VPS fail-closed com fixtures marcadas e cleanup seguro;
- repetir todos os gates locais e concluir runbook, rollback e handoff.

## Último gate confirmado

- 320/320 pgTAP, lint vazio e diff vazio após reset;
- 170/170 testes do Marketing Ops e 8/8 do Artifact Server;
- typecheck/build verdes;
- imagens Docker de Marketing Ops/Artifact Server construídas;
- smoke real de upload, ownership, URL assinada, download e cleanup passou.
- OpenAPI 26 paths/38 operações, 15 REST e 13 SDK/query keys verdes;
- smoke REST Docker real passou e o serviço ficou healthy após reset.
- lista acessível: 7/7 focados e 167/167 frontend;
- smoke browser desktop/mobile passou; proxy Vite local validado;
- reset removeu a fixture manual e Marketing Ops retornou healthy.
- semana/mês/timezone: 7/7 focados e 174/174 frontend;
- Playwright desktop/mobile 2/2, axe A/AA sem violações;
- grade mensal com overflow interno, lista equivalente e diálogo compartilhado.
- notificações/lote: 5/5 domínio, 16/16 REST e 22/22 frontend/SDK;
- regressão: 175 Marketing Ops e 179 frontend, typecheck/build/Redocly verdes;
- smoke browser/Docker: leitura segura, lote por item e layout móvel passaram;
- reset local removeu fixtures e Marketing Ops permaneceu healthy.

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
