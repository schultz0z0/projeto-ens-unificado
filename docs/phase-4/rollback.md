# Rollback — Fase 4

- **Estado:** `planned`
- **Implementação:** `not_started`

## Estratégia

Rollback da Fase 4 deve privilegiar desativação de superfície MCP/configuração,
não reversão destrutiva do domínio.

## Ordem de rollback planejada

1. desabilitar novas tools/actions da Fase 4 no runtime Hermes;
2. restaurar skill/contrato anterior do operador;
3. reverter configuração de endpoint MCP se necessário;
4. manter objetos já persistidos e a auditoria intactos;
5. reverter migration somente se houver schema novo e o dump tiver sido
   validado antes.

## Invariantes

- não apagar auditoria nem domain events;
- não apagar campanhas, itens, versões ou artifacts criados legitimamente;
- não remover rastreabilidade para "limpar" falha operacional;
- rollback de configuração não pode abrir caminho para mutação direta.

## Quando usar rollback

- tool catalog publicado com contrato incompatível;
- deep links incorretos em produção;
- falha de delegação/refresh que impeça operação segura;
- regressão crítica no runtime Hermes;
- vazamento de segredo ou token em log.

## Quando não usar rollback destrutivo

- conflito de versão esperado;
- falha parcial tratável por retry idempotente;
- ajuste de texto/skill sem impacto em segurança;
- resíduos documentais ou observacionais sem regressão funcional crítica.
