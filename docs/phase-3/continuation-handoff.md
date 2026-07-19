# Handoff de continuação — Fase 3

- **Estado:** `ready_for_vps_validation`
- **Branch única:** `main`
- **Snapshot:** 2026-07-19
- **Código/schema:** Tasks 1–10 completas e validadas localmente (100%)
- **Supabase:** migrations aplicadas; VPS ainda não homologada

## Ponto exato de continuação

Não há task de implementação pendente. A continuação é operacional:

1. rotacionar a credencial de banco indicada no [runbook](runbook.md);
2. publicar o commit final em `origin/main`;
3. implantar os quatro alvos na VPS com build limpo;
4. executar o gate não mutante;
5. executar jornada manual/E2E controlado;
6. comprovar logs, métricas, restart, persistência e cleanup;
7. registrar o aceite e só então promover a fase.

## Ordem de leitura

1. [README/status](README.md);
2. [PRD](../prds/phase-3-calendario-esteira-producao.md);
3. [rastreabilidade](requirements-traceability.md);
4. [validação local](local-validation.md);
5. [deploy Supabase](supabase-deployment.md);
6. [runbook VPS](runbook.md);
7. [checklist VPS](vps-validation.md);
8. [rollback](rollback.md);
9. [riscos](risk-register.md).

## Último gate confirmado

- 322/322 pgTAP, lint sem erro e schema diff vazio;
- 181 Marketing Ops, 179 frontend, 8 Artifact e 26 RAG;
- typecheck/build/OpenAPI/security gate verdes;
- performance p95 38,41 ms/5 mil campanhas e 45,45 ms/10 mil itens;
- E2E completo real em Docker, desktop/mobile/axe;
- métricas protegidas e logs sem sete categorias sensíveis;
- banco e artifact persistiram após restart;
- oito migrations promovidas ao Supabase do app após backup/dry-run;
- invariantes remotas da Fase 3 aprovadas.

## Regras de retomada

- somente `main`;
- não executar nova migration ou reset Supabase na VPS;
- não registrar secrets em comandos/evidências;
- `--no-cache` é recomendado no primeiro build completo da Fase 3;
- manter isolated DB gate desativado na VPS;
- não usar fixtures pessoais;
- não promover a Fase 4 antes da homologação da Fase 3.
