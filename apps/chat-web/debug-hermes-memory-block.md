[OPEN]

# Debug Session: hermes-memory-block

## Sintoma
- Erro intermitente de "Nao foi possivel processar o anexo com seguranca."
- Erro frequente do Hermes: "'NoneType' object is not iterable"
- Suspeita recorrente de falha ao puxar memoria/sessoes/tools do Hermes em follow-ups

## Hipoteses Falsificaveis
1. O Hermes falha internamente ao processar tools/memory em requests com `previous_response_id` e/ou `conversation` reaproveitados.
2. O proxy esta traduzindo um erro transitório do Hermes para `attachment_failed`, gerando falso positivo de seguranca.
3. O replay multimodal entre turnos esta reenviando anexos/contexto em formato valido para o proxy, mas invalido para a rota/modelo efetivo do Hermes.
4. O payload muda entre primeira pergunta e follow-up e o problema so aparece quando existe historico multimodal ou estado de sessao degradado.
5. A UI recebe SSE com erro sanitizado, mas perde o erro raiz do upstream e por isso mascara a causa real como conexao/seguranca.

## Evidencias Atuais
- Prints do usuario mostrando `NoneType object is not iterable`
- Prints do usuario mostrando erro de conexao + toast de seguranca no mesmo fluxo
- Historico recente confirma intermitencia: segunda tentativa as vezes funciona

## Proximo Passo
- Instrumentar proxy e cliente de stream para capturar causa raiz, classificacao de erro e shape do request sem expor dados sensiveis
