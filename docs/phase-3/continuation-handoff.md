# Handoff de continuação — Fase 3

- **Estado:** `ready_to_start_task_1`
- **Branch única:** `main`
- **Snapshot:** 2026-07-18
- **Código/schema Fase 3:** ainda não iniciado

## Ordem de leitura

1. [PRD](../prds/phase-3-calendario-esteira-producao.md);
2. [design](design.md);
3. [plano](../plans/2026-07-18-phase-3-calendario-esteira-producao-implementation.md);
4. [rastreabilidade](requirements-traceability.md);
5. [riscos](risk-register.md);
6. [progresso](implementation-progress.md).

## Ponto de início

Começar pela Task 1 do plano:

- escrever REDs pgTAP para tipos, colunas, constraints, RLS e migração de
  itens legados;
- criar migration aditiva da Fase 3;
- manter itens Fase 1 compatíveis;
- não iniciar UI antes do contrato de banco/domínio ficar verde.

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
