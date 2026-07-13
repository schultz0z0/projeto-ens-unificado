# Design - Confirmacao conversacional do Marketing Ops

- **Data:** 2026-07-13
- **Estado:** `implemented_and_validated_locally`
- **Classificacao:** hardening da Fase 1 com antecipacao minima do operador conversacional previsto para a Fase 4 e da confirmacao humana prevista para a Fase 5

## Problema observado

Na homologacao da Fase 1, um usuario `member` pediu em linguagem natural para criar uma campanha. O Hermes respondeu que `course_slug` era obrigatorio, embora o contrato MCP e o dominio aceitem campanha sem curso. Os testes tecnicos tambem exigiam do usuario termos como `expected_version` e `idempotency_key`, que nao pertencem a experiencia real.

A interface esperada e conversacional. O usuario descreve o resultado desejado; o Hermes consulta contexto, monta um plano e administra internamente campos tecnicos. Nenhuma mutacao pode ocorrer antes de uma confirmacao humana explicita.

## Decisoes aprovadas

1. O escopo inicial cobre somente o Marketing Ops.
2. Leituras podem ser feitas sem confirmacao.
3. Criar campanha, atualizar campanha e criar item exigem confirmacao.
4. Um plano pode conter varias mutacoes e recebe uma unica confirmacao.
5. Antes da confirmacao, nenhuma campanha, item, auditoria ou evento de dominio e persistido.
6. Qualquer mudanca ou ressalva invalida o plano anterior e exige nova apresentacao.
7. Campos tecnicos nao sao solicitados ao usuario quando puderem ser resolvidos pelo sistema.

## Arquitetura

### Skill e contrato conversacional

Uma skill `marketing-ops-operator` no fork do Hermes descreve como converter pedidos leigos em operacoes. Um contrato compacto e obrigatorio e injetado pela Bridge em todas as sessoes Nexus, evitando depender apenas da descoberta espontanea da skill.

O Hermes:

- omite `course_slug` quando o usuario nao pedir vinculo com curso;
- resolve versao atual por leitura antes de planejar uma edicao;
- nao mostra `delegation_token`, `idempotency_key`, `expected_version`, scopes ou nomes MCP;
- normaliza internamente versoes numericas serializadas como texto pelo modelo;
- apresenta todas as mutacoes planejadas em linguagem natural;
- informa explicitamente que nada foi salvo e pede uma confirmacao unica;
- so apresenta uma revisao como pronta depois de `prepare_plan_v1` concluir;
- encerra depois do resultado e nao reaproveita uma confirmacao para gravacoes em outros sistemas.

### Plano assinado e sem persistencia de dominio

`marketing_ops_prepare_plan_v1` valida a delegacao e as operacoes propostas, mas nao executa comandos de dominio. Ele devolve um token de plano assinado contendo ator, tenant, sessao, `jti` de preparacao, hash, validade e a lista exata de operacoes.

O token fica apenas no historico tecnico da sessao Hermes. Nenhuma tabela do Marketing Ops recebe um registro pendente. O token nao concede autoridade isoladamente e nao pode ser executado no mesmo turno em que foi preparado.

### Confirmacao confiavel

A Bridge classifica conservadoramente a mensagem original do usuario. Somente respostas inequivocas, como `confirmo`, `aprovo` ou `pode executar`, produzem uma delegacao com `confirmation_intent=true`. Mensagens com negacao, alteracao, ressalva ou texto ambiguo nao recebem essa claim.

`marketing_ops_execute_plan_v1` exige simultaneamente:

- delegacao fresca da Bridge com confirmacao explicita;
- mesmo usuario, tenant e sessao do plano;
- `jti` diferente do turno de preparacao;
- plano integro, nao expirado e assinado por chave ativa ou anterior;
- scopes e papel ainda validos no momento da execucao.

As operacoes usam chaves idempotentes derivadas do plano. Uma repeticao tecnica devolve os mesmos recursos e nao duplica campanhas ou itens.

### Gate no Hermes

O executor do fork bloqueia as tools MCP mutaveis de baixo nivel quando chamadas diretamente pelo modelo. O caminho permitido e `prepare_plan_v1` seguido, em outro turno explicitamente confirmado, por `execute_plan_v1`. O Marketing Ops revalida a confirmacao no backend, oferecendo defesa em profundidade.

## Fluxo

1. Usuario descreve casualmente o que deseja.
2. Hermes usa somente tools de leitura para buscar estado necessario.
3. Hermes prepara um plano assinado sem persistir dominio.
4. Hermes apresenta o plano completo e pede uma confirmacao unica.
5. Usuario confirma sem alterar o plano.
6. Bridge emite delegacao fresca marcada como confirmacao explicita.
7. Hermes executa exatamente o plano assinado.
8. Marketing Ops registra entidades, auditoria e outbox somente durante a execucao.
9. Hermes informa resultados reais, inclusive falhas parciais, sem falso sucesso.

## Falhas e alteracoes

- `sim, mas troque o titulo`: nao executa; novo plano e nova confirmacao.
- `nao execute`: cancela; nenhuma mutacao.
- plano expirado: prepara novamente e pede nova confirmacao.
- conflito de versao: nao altera silenciosamente; consulta estado, refaz o plano e pede nova confirmacao.
- falha depois de uma operacao: informa o que concluiu e permite retry idempotente do mesmo plano.

## Limites desta entrega

Publicacao, exclusao definitiva, agenda, envio externo, aprovacao por outro usuario e politicas gerais continuam fora da Fase 1. O mecanismo sera extensivel, mas esta implementacao cobre apenas as mutacoes MCP existentes na fundacao.

## Criterios de aceite

- pedido leigo sem curso gera plano com `course_slug` omitido;
- banco permanece inalterado antes da confirmacao;
- execucao no mesmo turno e recusada;
- confirmacao explicita em turno posterior executa o plano uma vez;
- confirmacao com ressalva nao executa;
- chamadas mutaveis diretas do Hermes sao bloqueadas;
- tenant, papel, scopes, idempotencia, concorrencia, auditoria e outbox continuam validos;
- testes locais Windows e imagens/runtime Linux passam antes do push.
