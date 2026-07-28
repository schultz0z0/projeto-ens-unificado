# Handoff de continuação — Fase 4

- **Estado:** `ready_for_user_deploy`
- **Snapshot:** 2026-07-28
- **Dependência anterior:** Fase 3 `production_validated`
- **Código:** implementação local concluída; gate VPS pendente

## Ordem de leitura

1. [README.md](README.md)
2. [implementation-progress.md](implementation-progress.md)
3. [local-validation.md](local-validation.md)
4. [runbook.md](runbook.md)
5. [vps-validation.md](vps-validation.md)

## Ponto exato de continuação

O escopo local da Fase 4 está concluído e o histórico de migration remoto está
alinhado. O próximo passo é o usuário executar o deploy na VPS; em seguida, o
assistente valida o checklist real de homologação e registra o aceite final.

## Artefatos críticos já entregues

- contrato do operador Hermes endurecido em `services/chat-bridge`;
- deep links e navegação SPA do Marketing Ops validados no `chat-web`;
- E2E fake do operador Hermes cobrindo confirmação e indisponibilidade;
- migration remota da auditoria Hermes aplicada no Supabase conectado.

## Regras de retomada

- não alterar o escopo funcional antes de repetir a validação na VPS;
- não expor mutações novas como tools diretas do MCP;
- não reabrir decisões da Fase 3 sem regressão comprovada;
- não promover a fase por documentação ou E2E fake sozinhos;
- usar `runbook.md` e `vps-validation.md` como fonte autoritativa do deploy.
