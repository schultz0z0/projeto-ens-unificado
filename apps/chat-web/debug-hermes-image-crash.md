# Debug Session: hermes-image-crash

Status: [OPEN]

## Sintoma
- Hermes responde texto simples normalmente.
- Quando a mensagem enviada contem imagem anexada ou mesmo apenas um link relacionado a imagem, a resposta falha.
- Evidencia ja observada: erro `'NoneType' object is not iterable` retornado pelo fluxo Hermes/proxy.

## Hipoteses Iniciais
1. O Hermes falha ao iterar sobre algum campo opcional nulo quando o input contem URL assinada do Storage.
2. O payload enviado ao `/v1/responses` muda de formato entre texto puro e mensagem com imagem/link, acionando um caminho quebrado no provider.
3. A URL assinada do Supabase ou o token de assinatura contem caracteres/estrutura que o Hermes tenta tratar como colecao ou bloco multimodal invalido.
4. O proxy `proxy-chatbot` preserva texto simples, mas no caminho com imagem/link repassa algum evento `response.failed` sem texto recuperavel, fazendo a UX aparentar queda total.
5. O problema nao esta no frontend, e sim numa incompatibilidade entre o formato de entrada esperado pelo Hermes e a forma como o app concatena markdown/link de anexos.

## Evidencias Coletadas
- `storage.buckets` confirma que `chat-attachments` existe e esta privado.
- `storage.objects` confirma uploads recentes no bucket `chat-attachments`, entao o upload do frontend nao e a causa desta falha.
- Reproducao via `proxy-chatbot`:
  - `message: "ola"` -> resposta valida do Hermes.
  - `message: "consegue abrir este link? https://example.com/teste.png"` -> `response.failed` com texto `'NoneType' object is not iterable`.
  - `message: "olha a imagem\n\n![teste](https://example.com/teste.png)"` -> mesma falha.
- Reproducao direta no Hermes `/v1/responses` sem frontend e sem proxy:
  - URL comum `https://example.com` -> `response.failed`.
  - Markdown link `[site](https://example.com)` -> `response.failed`.
  - Dominio simples `example.com` -> `response.failed`.
- Conclusao parcial: o gatilho e a presenca de URL/dominio no input, nao o bucket do Supabase nem a signed URL em si.

## Status das Hipoteses
1. O Hermes falha ao iterar sobre algum campo opcional nulo quando o input contem URL assinada do Storage.
   - Parcialmente refutada: nao depende de signed URL; qualquer URL/dominio reproduz.
2. O payload enviado ao `/v1/responses` muda de formato entre texto puro e mensagem com imagem/link, acionando um caminho quebrado no provider.
   - Nao sustentada ate aqui: reproduz diretamente no Hermes com input string simples.
3. A URL assinada do Supabase ou o token de assinatura contem caracteres/estrutura que o Hermes tenta tratar como colecao ou bloco multimodal invalido.
   - Refutada: `example.com` e `https://example.com` tambem quebram.
4. O proxy `proxy-chatbot` preserva texto simples, mas no caminho com imagem/link repassa algum evento `response.failed` sem texto recuperavel, fazendo a UX aparentar queda total.
   - Confirmada em parte: o proxy apenas repassa a falha do provider.
5. O problema nao esta no frontend, e sim numa incompatibilidade entre o formato de entrada esperado pelo Hermes e a forma como o app concatena markdown/link de anexos.
   - Confirmada parcialmente: o frontend nao e a origem; o provider quebra com URL simples.

## Proximos Passos
1. Reproduzir com payload de texto simples, link simples e link assinado de imagem.
2. Capturar a resposta SSE real do Hermes/proxy em cada caso.
3. Confirmar qual hipotese permanece valida.
4. So entao aplicar a menor correcao possivel.
