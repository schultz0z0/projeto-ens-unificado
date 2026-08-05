# Handoff de continuação — Fase 5

- **Estado:** `phase_5_planned`
- **Snapshot:** 2026-08-05
- **Implementação:** não iniciada
- **Dependências:** Fases 3–4 `production_validated`

## Ponto exato de continuação

O PRD e o design técnico estão aprovados. O próximo passo é executar o plano
task a task, começando por contratos/migration e testes RED do banco. Nenhuma
migration, rota, action MCP ou componente da Fase 5 foi implementado neste
snapshot.

## Ordem de leitura

1. [README](README.md);
2. [PRD](../prds/phase-5-governanca-aprovacoes.md);
3. [design](design.md);
4. [plano de implementação](../plans/2026-08-05-phase-5-governanca-aprovacoes-implementation.md);
5. [rastreabilidade](requirements-traceability.md);
6. [riscos](risk-register.md);
7. [validação local](local-validation.md).

## Regras permanentes

- manter approval técnico, editorial e operacional separados;
- não expor decisão ao Hermes;
- não criar worker/provedor na Fase 5;
- não alterar versão/payload aprovado;
- não permitir autoaprovação operacional;
- atualizar progresso/rastreabilidade/evidência junto de cada task;
- testes e validações de task são executados pelo assistente neste workspace;
- pós-deploy, homologação final é executada pelo assistente no navegador;
- somente o gate VPS permite marcar a fase como concluída.
