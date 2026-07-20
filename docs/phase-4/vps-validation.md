# Validação VPS — Fase 4

- **Estado:** `not_executed`
- **Implementação local:** `not_started`
- **Responsável pelo deploy/testes manuais:** usuário
- **Promoção final:** somente após evidência real e aceite

## Checklist planejado

- [ ] imagens e configuração publicadas;
- [ ] `marketing-ops`, Bridge e runtime Hermes healthy;
- [ ] descoberta do catálogo MCP em ambiente real;
- [ ] refresh de delegação funcionando;
- [ ] smoke de leitura de campanhas e agenda;
- [ ] plano preparado sem persistência prematura;
- [ ] execução confirmada criando/alterando objeto real;
- [ ] deep link abrindo objeto correto no frontend;
- [ ] logs correlacionados sem segredo;
- [ ] retry idempotente em produção controlada;
- [ ] rollback verificável.

## Evidência mínima esperada

- data do aceite;
- versão/commit implantado;
- rota MCP e services healthy;
- jornada manual por papel;
- resultado do smoke de conflito e indisponibilidade;
- aceite funcional do usuário.

## Resultado esperado

Enquanto algum item obrigatório estiver pendente, a Fase 4 permanece abaixo de
`production_validated`. Este documento só deve ser reconciliado depois do gate
VPS real.
