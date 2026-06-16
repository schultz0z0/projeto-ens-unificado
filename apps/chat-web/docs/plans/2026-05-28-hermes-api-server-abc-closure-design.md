# Hermes API Server ABC Closure Design

**Data:** 2026-05-28

**Objetivo**

Fechar definitivamente as etapas A, B e C do chat Hermes com foco em seguranca, consistencia de contrato, compatibilidade real com o Hermes API Server e manutencao de longo prazo. O alvo oficial desta integracao passa a ser o Hermes API Server, priorizando `/v1/responses` com conversa stateful, tools/thinking preservados no backend e documentos nao-imagem tratados como texto extraido server-side.

## Escopo Aprovado

- Alvo oficial: Hermes API Server, nao Subscription Proxy.
- Endpoint principal: `POST /v1/responses`.
- Documentos: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `md`, `txt`, `rtf` entram como texto extraido server-side.
- Imagens: seguem no caminho nativo com `input_image`.
- Tools/thinking: devem funcionar completamente no backend, sem exigir UI rica nova nesta fase.
- Refatoracao estrutural: obrigatoria nos hotspots principais do frontend e da Edge Function.

## Leitura da Documentacao do Hermes

### O que a doc suporta hoje

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/responses/{id}`
- `DELETE /v1/responses/{id}`
- `GET /v1/models`
- `GET /v1/capabilities`
- `GET /health`
- `GET /health/detailed`
- `POST /v1/runs`
- `GET /v1/runs/{run_id}`
- `GET /v1/runs/{run_id}/events`
- `POST /v1/runs/{run_id}/stop`
- `GET /api/jobs`, `POST /api/jobs`, `PATCH /api/jobs/{job_id}`, etc.
- `GET /api/sessions`, `POST /api/sessions/{id}/chat`, `POST /api/sessions/{id}/chat/stream`
- `GET /v1/skills`
- `GET /v1/toolsets`

### Implicacoes diretas para o desenho

- A doc do Hermes API Server suporta imagem inline/remota, mas nao suporta `input_file`, `file_id` nem documentos nao-imagem nativos via API.
- O caminho correto para documentos nesta integracao e extrair texto no backend e enviar como `input_text`.
- `conversation` e suportado em `/v1/responses` e evita depender de `previous_response_id` no cliente.
- `X-Hermes-Session-Key` e o mecanismo correto para escopo estavel de memoria de longo prazo em frontends multiusuario.
- `GET /v1/capabilities` deve ser usado para descoberta segura de features, evitando assumir suporte por comportamento implicito.
- `GET /v1/skills` e `GET /v1/toolsets` sao endpoints de discovery relevantes para futuras evolucoes, mas nao precisam ser exibidos na UI agora.

## Problemas Que Ainda Precisam Ser Fechados

### Etapa A

- O frontend aceita tipos que o bucket ainda nao aceita (`xls`, `xlsx`, `csv`).
- O cliente ainda participa demais da cadeia de confianca do anexo.
- O fluxo de signed URL ainda esta mais permissivo do que o necessario para um desenho seguro.

### Etapa B

- O proxy ainda aceita `signed_url` arbitraria do cliente.
- Falta validacao server-side de bucket, owner, escopo do path e host permitido.
- O proxy ainda vaza detalhe demais em alguns erros upstream.
- O contrato multimodal ainda nao esta explicitamente codificado como contrato Hermes API Server.

### Etapa C

- A implementacao de documentos esta funcional, mas precisa ser formalizada como "texto extraido oficial", nao como "arquivo nativo".
- O proxy ainda nao usa `X-Hermes-Session-Key`.
- O parser SSE ainda precisa ficar mais alinhado ao comportamento real do Hermes em tools/thinking sem ampliar a UI agora.
- Os arquivos centrais ainda estao grandes demais para manutencao segura.

## Decisao de Arquitetura

Adotar a abordagem `Hermes API Server nativo + anexos confiaveis server-side + documentos como texto extraido oficial`.

### Principios

- O frontend nao sera a fonte de verdade para seguranca de anexos.
- O backend validara integralmente o caminho do anexo antes de qualquer download ou repasse ao Hermes.
- O contrato oficial do chat sera modelado para `/v1/responses`.
- O suporte documental sera explicitamente textual, porque isso e o que a doc do Hermes suporta hoje.
- O backend preservara tools, thinking, memoria e contexto Hermes, mesmo quando a UI optar por nao representar tudo.

## Fluxo de Dados Final

1. O usuario escreve texto e/ou seleciona anexos.
2. O frontend valida tipo e tamanho com uma policy central unica.
3. O frontend faz upload do arquivo para o bucket privado `chat-attachments`.
4. O frontend persiste apenas metadados necessarios para historico e reuso seguro.
5. O frontend envia ao proxy um payload estruturado com:
   - `session_id`
   - `message_text`
   - `attachments[]` com metadados minimos e `storage_path`
6. A Edge Function autentica o usuario e valida:
   - bucket permitido
   - `storage_path` no escopo do usuario
   - tipo MIME permitido
   - limite de tamanho
   - origem permitida
7. A Edge Function resolve o arquivo no servidor, sem confiar em URL arbitraria do cliente.
8. O adapter Hermes constroi o payload `/v1/responses`:
   - `input_text` para texto da mensagem
   - `input_image` para imagens
   - `input_text` com texto extraido para documentos
9. O adapter envia `conversation` e `X-Hermes-Session-Key` estavel por usuario/sessao/canal.
10. O parser SSE normaliza o stream do Hermes para o frontend sem vazar detalhes internos.
11. O frontend persiste a mensagem final e mantem historico de anexos com refresh seguro de URL apenas quando necessario.

## Contrato Entre Frontend e Proxy

```json
{
  "session_id": "uuid-da-sessao",
  "message_text": "analise este material",
  "attachments": [
    {
      "kind": "image",
      "name": "screenshot.png",
      "mime_type": "image/png",
      "storage_path": "user-id/session-id/arquivo.png"
    }
  ]
}
```

### Regras do contrato

- `message_text` pode ser vazio apenas quando existir ao menos um anexo valido.
- `signed_url` nao fara mais parte do contrato confiavel vindo do cliente.
- `storage_path` precisa pertencer ao usuario autenticado e ao bucket esperado.
- `kind` e derivado de policy central e nao de heuristica frouxa.
- Os tipos aceitos pelo frontend, proxy e bucket devem ser identicos.

## Seguranca

- Bucket obrigatoriamente privado.
- Assinatura e resolucao do anexo no servidor.
- Validacao de ownership do `storage_path` com base no usuario autenticado.
- Allowlist de MIME types compartilhada entre frontend, proxy e migration.
- CORS fechado por allowlist explicita, sem fallback permissivo para `*`.
- Remocao de `upstream_response` cru para o cliente.
- Sanitizacao de erros Hermes e eventos SSE.
- Nenhum texto extraido de documento sera persistido em banco.

## Compatibilidade Hermes

### Fechado nesta entrega

- `/v1/responses` como endpoint canonico do chat
- `conversation` como chave de continuidade
- `X-Hermes-Session-Key` para escopo estavel de memoria
- `GET /v1/capabilities` como fonte de descoberta de features do server
- suporte a imagem nativa
- suporte a documentos via extracao textual oficial

### Preparado, mas fora da UI agora

- eventos de tool/thinking vindos do stream do Hermes
- `GET /v1/skills`
- `GET /v1/toolsets`
- possivel evolucao futura para `/v1/runs` e `/api/sessions/{id}/chat/stream`

## Refatoracao Estrutural

### Frontend

Quebrar `ChatInterface.tsx` em unidades menores:

- composer/send orchestration
- streaming client
- attachment hydration
- error recovery
- persistence helpers

### Edge Function

Quebrar `proxy-chatbot/index.ts` em modulos menores:

- auth e user context
- cors policy
- attachment policy
- attachment resolution server-side
- hermes request builder
- hermes response/SSE normalizer
- error sanitization

## Testes

- Unitarios de policy compartilhada de anexos
- Unitarios de validacao negativa do proxy
- Unitarios do adapter Hermes para `/v1/responses`
- Regressao para `X-Hermes-Session-Key`
- Regressao para sanitizacao de erro upstream
- Regressao de SSE com tools/thinking preservados no backend
- Regressao de URL expirada/refresh de anexo
- Lint e diagnostics nos arquivos alterados

## Criterios de Sucesso

- Texto puro continua funcionando.
- Imagem continua funcionando por caminho nativo.
- Documentos funcionam oficialmente como texto extraido.
- O proxy nao aceita mais URL arbitraria do cliente.
- `xls`, `xlsx` e `csv` ficam alinhados entre UI, proxy e bucket.
- O chat usa `conversation` e `X-Hermes-Session-Key` no Hermes API Server.
- O frontend nao perde o input em falhas precoces.
- O backend nao vaza erros internos do Hermes para o usuario.
- Os hotspots principais ficam menores e mais auditaveis.
