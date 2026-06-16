# Hermes Stage D Context Recovery Design

**Data:** 2026-05-29

## Objetivo

Fechar a Etapa D da integracao com o Hermes API Server garantindo continuidade robusta de contexto entre mensagens, apoio consistente a memoria/sessoes internas do Hermes e recuperacao automatica quando uma cadeia de conversa ficar corrompida ou passar a devolver `"'NoneType' object is not iterable"`.

## Escopo Aprovado

- O app continua tendo o Hermes API Server como alvo oficial.
- O app deve apoiar sessoes e memoria internas do Hermes, e nao tentar substitui-las.
- O app deve continuar usando `/v1/responses` como motor principal do chat.
- A `Sessions API` do Hermes sera incorporada no backend como camada de apoio estrutural.
- Quando o Hermes falhar ao encadear uma conversa antiga, o proxy deve tentar auto-recuperacao.
- Tools continuam completas no backend, com UI minima no frontend.

## Leitura da Documentacao do Hermes

### O que a doc indica

- `/v1/responses` suporta continuidade multi-turn com `conversation` e/ou `previous_response_id`.
- `GET /v1/responses/{id}` permite inspecionar respostas anteriores.
- `DELETE /v1/responses/{id}` permite remover respostas armazenadas.
- `POST /v1/runs` e `GET /v1/runs/{id}/events` sao alternativas boas para streaming reconectavel, mas nao sao obrigatorios nesta etapa.
- `Sessions API` expõe:
  - `POST /api/sessions`
  - `GET /api/sessions/{id}`
  - `POST /api/sessions/{id}/chat`
  - `POST /api/sessions/{id}/chat/stream`
  - `GET /api/sessions/{id}/messages`
  - `DELETE /api/sessions/{id}`
- `X-Hermes-Session-Key` e o mecanismo correto para escopo estavel de memoria de longo prazo.

### Implicacoes diretas

- `conversation` sozinho funciona no caminho feliz, mas nao oferece observabilidade suficiente quando a cadeia fica ruim.
- O app precisa rastrear melhor o estado da conversa Hermes por sessao do app.
- A `Sessions API` e util para:
  - criar/encerrar sessao Hermes por chat do app
  - inspecionar estado
  - apoiar recuperacao
- A memoria de longo prazo do Hermes deve continuar sendo guiada por `X-Hermes-Session-Key`, derivado da sessao do app.

## Problema da Etapa D

Hoje o follow-up simples funciona, mas existem conversas em que:

- o usuario faz uma pergunta que depende de uma mensagem anterior
- o Hermes deveria lembrar ou reconstruir contexto
- a resposta volta vazia ou com `"'NoneType' object is not iterable"`

Isso indica que existe pelo menos uma destas situacoes:

1. uma cadeia de `responses` ficou corrompida
2. a sessao Hermes nao esta claramente alinhada com a sessao do app
3. o Hermes precisa de apoio adicional para reancorar continuidade apos falhas
4. falta observabilidade para distinguir conversa saudavel de conversa degradada

## Decisao de Arquitetura

Adotar a abordagem `responses + sessions + auto-recovery`.

### Principios

- O chat do app continua sendo a unidade de UX.
- Cada chat do app passa a ter um vinculo explicito com a sessao Hermes.
- O backend passa a persistir estado minimo de continuidade do Hermes.
- O backend detecta cadeia degradada e tenta recuperacao automatica sem quebrar a UX.
- O frontend nao assume o papel de gerenciar memoria do Hermes.

## Modelo Conceitual

### Sessao do App

Sessao persistida no Supabase e usada pela UI para:

- historico visual
- exclusao de chat
- ordenacao e titulo

### Sessao do Hermes

Sessao persistida no Hermes e usada para:

- continuidade administrativa/rest
- inspecao de mensagens
- apoio a recuperacao

### Cadeia de Responses

Continuidade operacional de curto prazo do turno atual, com:

- `conversation`
- `response_id`
- `previous_response_id`

### Memoria Hermes

Continuidade de longo prazo favorecida por:

- `X-Hermes-Session-Key`

## Estado Persistido Necessario

Nova tabela de vinculo entre o chat do app e o Hermes:

- `chat_session_id`
- `user_id`
- `hermes_session_id`
- `hermes_conversation_id`
- `last_response_id`
- `last_good_response_id`
- `chain_health`
- `last_error_code`
- `last_error_at`
- `created_at`
- `updated_at`

### Regras

- `chain_health` pode assumir `healthy`, `degraded`, `recovering`.
- `last_good_response_id` so atualiza quando o turno fecha de forma valida.
- apagar o chat no app deve encerrar o vinculo local e, quando possivel, encerrar a sessao Hermes correspondente.

## Fluxo de Dados Final da Etapa D

1. Usuario envia mensagem em um chat do app.
2. Backend carrega ou cria o vinculo Hermes para aquela sessao do app.
3. Backend garante existencia de `hermes_session_id`.
4. Backend monta payload `/v1/responses` com:
   - `conversation`
   - `previous_response_id` quando houver resposta boa conhecida
   - `X-Hermes-Session-Key`
5. Backend faz streaming do Hermes.
6. Se o stream for saudavel:
   - atualiza `last_response_id`
   - atualiza `last_good_response_id`
   - mantem `chain_health = healthy`
7. Se o Hermes devolver falha estrutural:
   - marca `chain_health = degraded`
   - registra `last_error_code`
   - tenta auto-recuperacao
8. Na auto-recuperacao:
   - reancora na ultima resposta boa conhecida ou
   - cria nova conversa Hermes dentro da mesma sessao sem perder a UX do chat
9. Se recuperar:
   - marca `chain_health = healthy`
10. Se nao recuperar:
   - devolve erro guiado e observavel

## Auto-Recovery

### Quando acionar

- `response.failed`
- erro textual com `NoneType`
- stream vazio apos criacao de resposta
- impossibilidade de encadear com o ultimo `response_id`

### Estrategia

Primeira tentativa:

- usar `previous_response_id = last_good_response_id`

Segunda tentativa:

- manter `hermes_session_id`
- girar `conversation` para nova ancora controlada

Terceira tentativa:

- abrir nova sessao Hermes vinculada ao mesmo chat do app
- manter `X-Hermes-Session-Key`

### O que nao fazer

- nao resetar memoria Hermes global
- nao apagar historico local do usuario
- nao mascarar erro sem registrar causa

## Uso da Sessions API

### Nesta entrega

- criar sessao Hermes ao abrir ou inicializar um chat do app
- consultar metadata quando necessario
- encerrar sessao Hermes ao excluir chat do app
- opcionalmente consultar mensagens para diagnostico e reconciliacao

### Fora do escopo agora

- migrar o fluxo principal inteiro para `/api/sessions/{id}/chat/stream`
- UI rica de gerenciamento de sessoes Hermes

## Tools e Streaming

- O backend continua aceitando tools/thinking completos do Hermes.
- O parser SSE continua normalizando o stream para a UI.
- O frontend continua mostrando no maximo estados uteis, sem trace detalhado de tool calls.
- O estado do backend deve guardar se a ultima resposta falhou depois de tool output parcial, para nao envenenar a cadeia.

## Refatoracao Estrutural

### Backend

Novos modulos previstos:

- `hermesSessionsClient.ts`
- `hermesConversationState.ts`
- `hermesRecoveryStrategy.ts`
- `hermesResponseInspector.ts`

### Frontend

Mudancas minimas:

- consumir mensagens de status de recuperacao quando vierem do backend
- nao reestruturar a UI do chat alem do necessario

## Testes

- criacao de vinculo entre chat do app e sessao Hermes
- resposta saudavel atualiza `last_good_response_id`
- `response.failed` marca cadeia como degradada
- recovery usando `last_good_response_id`
- recovery com nova `conversation`
- exclusao do chat encerra vinculo e aciona cleanup Hermes
- follow-up continua funcionando no caminho feliz
- imagem e documentos nao regressam

## Criterios de Sucesso

- follow-up indireto nao quebra mais com `NoneType`
- sessoes do app favorecem continuidade Hermes
- memoria Hermes continua estavel via `X-Hermes-Session-Key`
- o backend diferencia conversa saudavel de degradada
- excluir o chat no app encerra a sessao correspondente do lado do app/Hermes
- tools continuam funcionando no backend
- a UX nao fica muda em caso de recovery
