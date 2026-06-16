# Design: Chat Attachments With Signed URLs

**Data:** 2026-05-28

**Objetivo**

Corrigir o envio de imagens no chatbot garantindo que os anexos sejam armazenados em um bucket privado do Supabase Storage e consumidos pelo Hermes via signed URLs de curta duração.

**Problema Atual**

O frontend tenta subir anexos para o bucket `chat-attachments`, mas esse bucket nao existe no projeto Supabase atual. O upload falha com `400 Bad Request` e `Bucket not found`, interrompendo o fluxo antes do envio da mensagem ao chatbot.

**Decisao**

Adotar bucket privado com signed URL para leitura temporaria. O upload continua sendo feito pelo cliente autenticado, mas a leitura do arquivo nao fica publica. O path do arquivo permanece isolado por usuario, usando a pasta raiz `auth.uid()`.

**Abordagens Consideradas**

1. Bucket publico com `getPublicUrl()`
   - Mais simples e compativel com o codigo atual.
   - Rejeitado por expor anexos por URL publica.

2. Bucket privado com `createSignedUrl()`
   - Mantem compatibilidade com o fluxo do Hermes baseado em URL.
   - Reduz a exposicao dos anexos e atende melhor a LGPD.
   - Escolhido.

3. Upload mediado por Edge Function
   - Mais blindado no longo prazo.
   - Nao necessario para resolver o bug atual.

**Arquitetura**

- Criar o bucket privado `chat-attachments` via migration SQL.
- Definir RLS no `storage.objects` para permitir `select/insert/update/delete` apenas sobre arquivos cujo primeiro segmento de pasta seja igual ao `auth.uid()`.
- Extrair a logica de upload e assinatura de anexos para um servico dedicado, evitando ampliar ainda mais `ChatInterface.tsx`.
- Validar os metadados dos anexos com Zod antes do upload e antes de montar os `ChatMessagePart`.
- Gerar signed URLs de curta duracao para cada arquivo antes de compor o markdown enviado ao Hermes.

**Fluxo de Dados**

1. Usuario seleciona imagem no composer do chat.
2. Front valida o anexo localmente.
3. Front sobe o arquivo para `chat-attachments/{userId}/{sessionId}/{timestamp}-{safeName}`.
4. Front gera signed URL com expiracao curta para o arquivo salvo.
5. Front persiste o `ChatMessagePart` com a URL assinada no fluxo atual.
6. Hermes recebe a mensagem com a URL temporaria e processa a imagem.

**Arquivos Esperados**

- Criar migration SQL para bucket e policies.
- Criar servico dedicado para anexos do chat.
- Ajustar `src/components/ChatInterface.tsx` para consumir o servico.
- Adicionar teste focado no servico de anexos.

**Tratamento de Erros**

- Traduzir `Bucket not found` para uma mensagem operacional clara.
- Falhas de upload e assinatura devem interromper o envio antes da chamada ao Hermes.
- Falhas de validacao local devem impedir upload desnecessario.

**Seguranca**

O bucket privado com signed URL reduz o risco de exposicao acidental de anexos e respeita melhor o principio de menor privilegio. Ainda assim, como a URL assinada sera enviada ao Hermes, a implementacao deve manter expiracao curta, limitar tamanho e MIME types permitidos no bucket e validar o payload localmente com Zod antes do upload. Uma evolucao futura seria mover esse upload para uma Edge Function ou token de upload assinado, eliminando ainda mais a confianca no cliente.
