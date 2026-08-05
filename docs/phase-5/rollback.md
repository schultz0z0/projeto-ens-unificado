# Rollback — Fase 5

- **Estado:** `ready`
- **Estratégia:** flags + imagens anteriores + forward-fix

## Ação imediata

1. definir `NEXUS_MARKETING_OPS_FEATURE_APPROVALS=false`;
2. definir `NEXUS_MARKETING_OPS_FRONTEND_APPROVALS=false`;
3. reconstruir/recriar `marketing-ops` e `app-frontend`;
4. se houver regressão conversacional, voltar também `app-bridge` e
   `hermes-api` para a imagem/commit anterior;
5. confirmar `/ready`, `/health`, logs e campanhas das Fases 1–4.

Não executar `docker compose down`, não remover volumes e não apagar requests,
decisões, action packages, auditoria ou migrations. O schema é aditivo e a
aplicação anterior ignora os objetos novos.

## Por cenário

- **Frontend:** flag pública off + imagem anterior do `app-frontend`.
- **API/domínio:** flag backend off + imagem anterior do `marketing-ops`.
- **MCP/Hermes:** retirar a skill/actions por rollback de `hermes-api` e
  `app-bridge`; REST permanece isolado.
- **Schema:** bloquear escrita, preservar dados e aplicar forward-fix. Restore
  completo somente com backup validado e autorização explícita.

## Verificação

- serviços healthy e readiness verde;
- Fases 1–4 preservadas;
- capability/rota da Fase 5 invisível com flags off;
- nenhuma execução externa;
- correlation IDs e incidente registrados.
