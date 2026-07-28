# Handoff de continuação — Fase 4

- **Estado:** `pending_contextual_classifier_hardening_redeploy`
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
alinhado. Os três hotfixes de compatibilidade MCP foram publicados; a leitura
real de campanhas/agenda concluiu no chat de produção, confirmando transporte,
tool e resposta ponta a ponta sem mutação.

O preview seguinte revelou que o agente tentava misturar enriquecimento com
`campaign.create_draft`, cujo schema é estrito. O Marketing Ops recusou antes
de assinatura/persistência. Há um quarto hotfix local, testado com RED/GREEN e
85/85 testes da Bridge: ele instrui criação somente com `type`, `ref`, `name`
e `course_slug` opcional e exige um segundo ciclo para `campaign.update`.
O sexto hotfix foi publicado e o preview passou no app real, sem persistência.
A confirmação contextual em turno posterior foi recusada porque a Bridge só
reconhecia frases literais. A correção contextual substituiu esse detector:
`hermes-api` classifica a resposta contra o plano pendente, sem tools, e a
Bridge assina confirmação somente para `approve`. O primeiro teste publicado
provou o fail-closed, mas revelou que o modelo respondia fora do JSON estrito.
O oitavo hotfix isola o classificador da persona conversacional, exige a linha
fechada `NEXUS_MARKETING_OPS_DECISION: {"decision":"..."}` e registra somente
o enum/aderência ao contrato. Pergunta, negação, ressalva, adiamento e alteração
continuam fechados; alteração exige novo preview. Os gates locais do runtime
(12/12) e os 86 testes da Bridge passaram. Publique `hermes-api` e `app-bridge`
com o bloco pontual de `runbook.md`, repita preview e confirmação, consulte o
log sanitizado se houver falha e só então retome os testes reais de escrita.

## Artefatos críticos já entregues

- contrato do operador Hermes endurecido em `services/chat-bridge`;
- deep links e navegação SPA do Marketing Ops validados no `chat-web`;
- E2E fake do operador Hermes cobrindo confirmação e indisponibilidade;
- migration remota da auditoria Hermes aplicada no Supabase conectado.

## Regras de retomada

- não alterar o schema nem afrouxar `campaign.create_draft` para contornar o
  erro de composição; a correção está no contrato do operador;
- não expor mutações novas como tools diretas do MCP;
- não reabrir decisões da Fase 3 sem regressão comprovada;
- não promover a fase por documentação ou E2E fake sozinhos;
- usar `runbook.md` e `vps-validation.md` como fonte autoritativa do deploy.
