# Handoff de continuação — Fase 2 encerrada

- **Estado:** `phase_closed`
- **Branch única:** `main`
- **Snapshot:** 2026-07-18
- **Homologação VPS:** `production_validated`
- **Próxima frente:** pacote e implementação da Fase 3

Este documento substitui o handoff intermediário que apontava Tasks 14/15 e
deploy VPS como pendentes. A Fase 2 foi implementada integralmente e homologada
na VPS em 2026-07-16. O saneamento de 2026-07-18 fechou os gates locais de lint,
pgTAP e performance.

## Para retomar em outro computador

```powershell
git clone <url-do-repositorio>
Set-Location Projeto-ens-unificado
git checkout main
git pull --ff-only origin main
git status --short --branch
```

Ler, nesta ordem:

1. [README da Fase 2](README.md);
2. [rastreabilidade final](requirements-traceability.md);
3. [validação local](local-validation.md);
4. [decisões](decision-log.md);
5. [README da Fase 3](../phase-3/README.md);
6. plano datado da Fase 3 em `docs/plans/`.

## Delta pendente de deploy

A migration
`apps/chat-web/supabase/migrations/20260718183937_add_campaign_list_tenant_updated_index.sql`
foi validada localmente, mas ainda não foi aplicada remotamente. Antes do
próximo gate de produção:

1. confirmar o projeto Supabase do app;
2. fazer backup e registrar hashes;
3. executar e revisar `db push --linked --dry-run`;
4. aplicar somente migrations conhecidas;
5. executar lint/advisors e smoke da lista;
6. registrar o resultado em [supabase-deployment.md](supabase-deployment.md).

## Regras permanentes

- trabalhar apenas em `main`;
- não criar outra branch;
- o agente pode criar commits locais testados;
- o usuário executa `git push` e deploy na VPS;
- nunca copiar secrets para logs ou documentação;
- não tratar o RAG como fonte transacional;
- não implementar Fase 3 antes de manter seu PRD/design/plano coerentes.

Não há código inacabado da Fase 2. Alterações futuras nela devem ser tratadas
como correção regressiva ou dívida explícita, sem reabrir silenciosamente o
escopo.
