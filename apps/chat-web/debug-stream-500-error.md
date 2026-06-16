# Debug Session: stream-500-error

Status: OPEN

## Sintoma

- `POST /functions/v1/proxy-chatbot/api/chat/stream` retorna `500 Internal Server Error`
- O cliente mostra `internal_error`
- O usuario afirma que migration SQL e deploy da function ja foram aplicados

## Hipoteses

1. A function publicada no Supabase nao corresponde ao codigo local mais recente e ainda referencia um estado/schema diferente.
2. A migration foi aplicada, mas falhou parcialmente ou foi aplicada em outro projeto/ambiente, entao a tabela `chat_session_hermes_state` ou seus objetos auxiliares nao existem no projeto usado pelo frontend.
3. O Hermes remoto nao anuncia `Sessions API` em `/v1/capabilities`, e a validacao `assertHermesSessionCapabilities()` derruba a request em runtime.
4. Existe falha de permissao/consulta no acesso admin ao Supabase durante leitura/escrita de `chat_session_hermes_state`, gerando excecao interna antes do stream iniciar.
5. O erro vem de uma excecao em recovery/session binding e o corpo `internal_error` esta mascarando um detalhe que so aparece no log real da Edge Function.

## Evidencia Coletada

- Network: `500 Internal Server Error`
- Header: `sb-error-code=EDGE_FUNCTION_ERROR`
- Ainda sem stack/log da Edge Function

## Proximo Passo

- Coletar logs reais do runtime da Edge Function e/ou corpo detalhado da resposta
- Validar se a function publicada suporta `Sessions API` e se o schema remoto contem `chat_session_hermes_state`
