# Handoff de continuação — Fase 5

- **Estado:** `ready_for_vps_deploy`
- **Snapshot:** 2026-08-05
- **Implementação:** Tasks 1–8 concluídas e validadas
- **Supabase:** implantado e verificado
- **Pendente:** deploy das imagens na VPS e homologação manual pelo assistente

## Ponto exato de continuação

Publicar o commit final em `main`, seguir `runbook.md` e informar ao assistente
a URL/credenciais de homologação já autorizadas. Não reaplicar migrations: as
sete migrations da Fase 5 já constam no projeto `murxwqdevpwjtnnuzzxi`.

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

Executar exatamente `vps-validation.md`. Somente o assistente marca
`production_validated` após testar manualmente o site e conferir as evidências
no Supabase/VPS.
