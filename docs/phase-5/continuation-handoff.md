# Handoff de continuação — Fase 5

- **Estado:** `production_validation_blocked`
- **Snapshot:** 2026-08-06
- **Implementação:** Tasks 1–8 concluídas e validadas
- **Supabase:** implantado e verificado
- **Pendente:** corrigir dois bloqueadores de produção, redeploy e repetir homologação

## Ponto exato de continuação

Corrigir primeiro a RLS/projeção de notificação que reverte decisões por
manager/admin e o cache compartilhado de respostas autenticadas. Também
diferenciar erros de mutação na UI. Depois publicar o hotfix, seguir
`runbook.md` e repetir `vps-validation.md`. Não reaplicar cegamente as sete
migrations existentes; qualquer ajuste de RLS deve ser uma migration aditiva e
versionada no projeto `murxwqdevpwjtnnuzzxi`.

## Flags obrigatórias

```text
NEXUS_MARKETING_OPS_FEATURE_APPROVALS=true
NEXUS_MARKETING_OPS_FRONTEND_APPROVALS=true
NEXUS_MARKETING_OPS_APPROVAL_EXPIRY_INTERVAL_MS=30000
NEXUS_MARKETING_OPS_APPROVAL_EXPIRY_BATCH_SIZE=100
```

As demais flags de Marketing Ops das Fases anteriores continuam `true`. A flag
do frontend é build-time e exige rebuild de `app-frontend`.

## Serviços afetados

- `marketing-ops`: domínio, REST, MCP, métricas e dependência atualizada;
- `app-frontend`: fila/detalhe, SDK, notificações e flag build-time;
- `app-bridge`: scope técnico `approval:submit`;
- `hermes-api`: skill Marketing Ops 1.3.0.

## Gate seguinte

Executar regressões PostgreSQL reais para decisão/notificação e troca de conta
no mesmo deep link, fazer redeploy e então repetir exatamente
`vps-validation.md`. Somente o assistente marca `production_validated` após
testar manualmente o site e conferir as evidências no Supabase/VPS.
