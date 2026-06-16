# Hermes Multimodal Chat Design

**Data:** 2026-05-28

**Objetivo**

Corrigir estruturalmente a integracao do chat com o Hermes para que imagens e PDFs nao sejam mais enviados como markdown/URL textual, mas sim como payload multimodal estruturado, com fallback textual efemero no backend quando o suporte nativo do provider nao se confirmar.

## Problema Atual

- O frontend hoje transforma anexos em markdown textual e concatena isso no `message` enviado ao `proxy-chatbot`.
- O `proxy-chatbot` aceita apenas `message: string` e repassa `input` como string simples ao Hermes.
- Em reproducao direta, o Hermes falha com `response.failed` e `error.message: "'NoneType' object is not iterable"` sempre que o input contem URL ou dominio, inclusive sem frontend e sem Supabase Storage.
- O upload para `chat-attachments` ja funciona e nao e a causa raiz da quebra.

## Decisao de Arquitetura

Adotar a abordagem `multimodal nativo primeiro + fallback textual efemero`.

- `image/*`: sempre tentar primeiro o caminho multimodal nativo do provider.
- `application/pdf`: tentar primeiro o caminho multimodal nativo; em caso de falha confirmada ou suporte ausente, executar fallback textual efemero no backend.
- `doc/docx/xls/xlsx`: deixar a arquitetura preparada, mas fora do escopo desta primeira entrega.
- URLs digitadas manualmente pelo usuario nao serao mais tratadas como “imagem por texto”; o foco passa a ser anexo estruturado.

## Fluxo de Dados

1. O usuario escreve texto e/ou adiciona anexos.
2. O frontend valida anexo com Zod.
3. O frontend sobe o arquivo para `chat-attachments`.
4. O frontend gera signed URL curta e monta um payload estruturado para o proxy:
   - `session_id`
   - `message_text`
   - `attachments[]`
5. O `proxy-chatbot` valida o payload com Zod.
6. O proxy converte `attachments[]` para o formato de entrada multimodal do Hermes/OpenAI-compatible.
7. Se `pdf` falhar no caminho multimodal, o proxy baixa o arquivo com signed URL, extrai texto em memoria e reenvia ao Hermes como texto estruturado.
8. O proxy streama SSE normalizado para o frontend.
9. O frontend persiste a mensagem do usuario e a resposta do assistente como hoje, mantendo as partes de arquivo no historico.

## Contrato Proposto Entre Frontend e Proxy

```json
{
  "session_id": "uuid-da-sessao",
  "message_text": "analise este arquivo",
  "attachments": [
    {
      "kind": "image",
      "name": "imagem.png",
      "mime_type": "image/png",
      "storage_path": "user/session/timestamp-imagem.png",
      "signed_url": "https://..."
    }
  ]
}
```

### Regras do contrato

- `message_text` pode ser vazio somente se existir ao menos um anexo valido.
- `attachments` e opcional, mas quando presente deve conter apenas itens com `kind`, `mime_type`, `storage_path` e `signed_url` validos.
- `signed_url` e de curta duracao e usada apenas pelo proxy/Hermes, nao como armazenamento permanente.

## Mudancas Esperadas por Camada

### Frontend

- Parar de montar `messageForModel` com markdown de anexos.
- Manter o upload e a persistencia dos anexos para UI/historico.
- Passar a enviar ao proxy um objeto estruturado com texto + anexos.
- Bloquear envio quando houver anexo invalido ou sem os campos necessarios.

### Proxy Chatbot

- Trocar o schema atual `message: string` por `message_text` + `attachments[]`.
- Implementar um builder de payload multimodal do Hermes.
- Implementar roteamento por tipo de arquivo:
  - imagem -> multimodal nativo
  - pdf -> multimodal nativo, fallback textual efemero
- Manter mensagens de erro amigaveis ao cliente.

## Segurança

- Continuar com bucket privado e signed URLs curtas.
- Nao persistir texto extraido de PDF no banco.
- Nao expor mensagens internas do Hermes ao usuario final.
- Validar rigidamente MIME type, tamanho e estrutura do payload antes de qualquer chamada ao provider.

## Testes

- Unitario do builder de payload multimodal no frontend.
- Unitario do schema Zod e do builder multimodal no proxy.
- Regressao para garantir que anexos nao sao mais enviados ao Hermes como markdown textual.
- Caso de imagem nativa.
- Caso de PDF com caminho nativo e com fallback.

## Criterios de Sucesso

- Texto puro continua funcionando.
- Imagem anexada nao e mais enviada como URL textual e nao derruba o Hermes.
- PDF anexado tenta multimodal nativo e, se falhar, ainda consegue seguir por fallback textual efemero.
- Erros do provider aparecem ao usuario de forma amigavel, sem stack interna.
