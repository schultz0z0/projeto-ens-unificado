# Handoff de continuação — Fase 5

- **Estado:** `ready_for_production_revalidation`
- **Snapshot:** 2026-08-06
- **Implementação:** Tasks 1–8 concluídas e validadas
- **Supabase:** migration `5.0.5` implantada e verificada
- **Pendente:** redeploy do hotfix e repetição integral da homologação

## Ponto exato de continuação

Publicar o hotfix, seguir `runbook.md` e repetir `vps-validation.md`. A migration
`20260806152536_phase_5_notification_rls_parameterized_fix.sql` já está aplicada
no projeto `murxwqdevpwjtnnuzzxi`; não a reaplicar nem reaplicar cegamente as
migrations anteriores. O deploy ainda precisa atualizar Marketing Ops,
frontend, Bridge e Hermes runtime.

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
