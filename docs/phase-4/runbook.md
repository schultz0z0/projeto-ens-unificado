# Runbook — Fase 4

- **Estado:** `planned`
- **Implementação:** `not_started`
- **Objetivo:** preparar deploy e operação controlada do operador Hermes sobre o `marketing-ops`

## Escopo operacional

Este runbook cobre a parte operacional da Fase 4:

- configuração MCP do `marketing-ops` no runtime Hermes;
- secrets e refresh de delegação;
- validação de rede interna e health;
- smoke da jornada conversacional em ambiente real;
- rollback de configuração.

## Pré-deploy planejado

Antes do primeiro deploy da fase:

- revisar o catálogo final de tools e actions;
- confirmar URLs internas do MCP e da Bridge;
- validar rotação e presença apenas dos secrets necessários;
- confirmar que o runtime Hermes continua bloqueando mutações diretas;
- revisar o plano de rollback.

## Deploy planejado

1. publicar imagem/configuração do `marketing-ops` com MCP atualizado;
2. publicar configuração do runtime Hermes com skill/contrato atualizados;
3. reiniciar serviços de forma controlada;
4. validar `/health`, `/ready` e descoberta do catálogo MCP;
5. executar smoke de leitura antes de qualquer mutação.

## Smoke mínimo esperado

- Hermes lista campanhas autorizadas;
- Hermes lê agenda real de uma campanha;
- Hermes prepara um plano sem persistir nada;
- Hermes executa um plano confirmado e devolve deep link;
- frontend abre o objeto retornado.

## Logs e segurança

- nunca registrar `delegation_token` ou `plan_token`;
- não copiar respostas integrais com conteúdo sensível para a documentação;
- logs devem permitir correlação por `correlation_id`, ferramenta e run.

## Critério de execução

Este runbook só muda para `executed_and_reusable` quando houver deploy real,
smoke real e aceite do usuário no gate VPS.
