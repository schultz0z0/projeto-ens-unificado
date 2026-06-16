# Plano de Reformulacao do Chatbot Hermes-Agent

## Objetivo

Transformar o chatbot do Nexus AI em uma interface robusta para o Hermes Agent, capaz de acompanhar tarefas longas, com muitas tool calls, memoria, skills, geracao de arquivos e imagens, sem depender de uma unica conexao SSE aberta ate o fim.

## Estado Atual

O frontend conversa com a Supabase Edge Function `proxy-chatbot`, que chama o Hermes API Server. Esse fluxo funciona bem para interacoes curtas e medias, mas fica fragil quando o Hermes executa tarefas longas, como navegacao, pesquisa, uso de skills, geracao de imagem, terminal e leitura de arquivos.

Fluxo atual:

```text
Frontend
  -> Supabase Edge Function proxy-chatbot
    -> Hermes API Server
      -> Hermes Agent/tools
```

Problema principal:

```text
Se a conexao SSE cai, a interface perde a resposta mesmo que o Hermes continue ou conclua a tarefa.
```

## Arquitetura Alvo

Criar um backend persistente na VPS, no mesmo ambiente operacional do Hermes, para atuar como uma ponte dedicada entre o frontend e o Hermes Agent.

Fluxo alvo:

```text
Frontend em chat.solucoes-nexus.tech
  -> Nexus Hermes Bridge na VPS
    -> Hermes API Server na VPS
      -> Hermes Agent/tools/memory/skills
```

Esse backend nao deve depender de uma requisicao longa unica. Ele deve criar um job/run, persistir estado e permitir que o frontend acompanhe o progresso por polling, SSE proprio ou WebSocket.

## Arquitetura Implementada Para Producao

O compose `app-nexus-ai` hospeda dois containers:

- `frontend`: entrega a interface em `https://chat.solucoes-nexus.tech`.
- `bridge`: entrega a API de chat em `https://chat-api.solucoes-nexus.tech`.

O Hermes continua em compose vizinho na mesma VPS. A integracao entre bridge e Hermes deve usar a rede Docker compartilhada `nexus-hermes-net`, com `HERMES_API_BASE_URL` apontando para a URL interna do servico Hermes, por exemplo `http://hermes-api:8000`.

Fluxo de producao:

```text
Navegador
  -> chat.solucoes-nexus.tech
  -> chat-api.solucoes-nexus.tech
  -> bridge no compose app-nexus-ai
  -> Hermes API Server no compose nexus-hermes
  -> Hermes Agent / tools / MCP / skills / memoria / sub-sessoes internas
```

### Sessao raiz e sub-sessoes Hermes

Cada chat do historico do Nexus AI e tratado como uma sessao raiz do Hermes. A bridge persiste o vinculo em `chat_session_hermes_state` e envia `X-Hermes-Session-Key` e `X-Hermes-Session-Id` para o API Server.

As sub-sessoes que o Hermes abrir internamente para tools, MCP, agentes auxiliares ou tarefas delegadas nao sao controladas pela interface. Elas continuam sendo responsabilidade do Hermes. A bridge apenas acompanha a execucao raiz e captura eventos, texto final e arquivos gerados.

### Execucoes longas

O frontend nao depende mais de um POST SSE unico. Ele cria uma execucao em `POST /api/chat/runs` e acompanha por `GET /api/chat/runs/:id/events?cursor=N`.

Se a conexao cair, o frontend reconecta no mesmo `bridge_run_id` e no ultimo cursor processado. A tarefa do Hermes continua na bridge.

### Anexos

O Supabase continua util para:

- autenticar o usuario;
- guardar historico da interface;
- armazenar anexos privados no bucket `chat-attachments`;
- persistir o estado de conversa Hermes em `chat_session_hermes_state`.

A bridge usa `SUPABASE_SERVICE_ROLE_KEY` somente no backend para baixar anexos privados, criar URL assinada temporaria e extrair texto quando possivel. A service role key nunca deve ir para o build do Vite/frontend.

Roteamento de payload:

- texto puro e arquivos com texto extraido usam preferencialmente `/v1/runs`;
- imagens e arquivos sem texto extraido usam `/v1/responses` com payload multimodal;
- imagens sao enviadas como `input_image`; se o caminho inline falhar, a bridge tenta URL assinada remota.

## Infraestrutura Inicial

### Frontend

O frontend passa a poder ser hospedado na VPS via Docker Compose:

- Compose: `docker-compose.yml`
- Nome do projeto: `app-nexus-ai`
- Dominio: `chat.solucoes-nexus.tech`
- Proxy reverso: Traefik externo ja existente
- Porta interna do container: `8080`
- Rede Docker compartilhada: `nexus-hermes-net`

### Traefik

O Traefik continua em compose separado, com `network_mode: host` e Docker provider ativo. O container do frontend usa labels Docker para:

- ativar o Traefik;
- rotear `Host(chat.solucoes-nexus.tech)`;
- usar entrypoint `websecure`;
- usar resolver `letsencrypt`;
- aplicar compressao e headers basicos.

### Rede Docker Compartilhada

A rede `nexus-hermes-net` sera criada pelo compose do frontend. O compose do Hermes e, futuramente, o compose da bridge devem entrar nessa rede como `external: true`.

Exemplo para o compose do Hermes:

```yaml
networks:
  nexus-hermes-net:
    external: true

services:
  hermes:
    networks:
      - nexus-hermes-net
```

## Fase 1: Subir o Frontend na VPS

1. Copiar o projeto para a VPS.
2. Criar o arquivo `.env` na raiz a partir de `app-nexus-ai.env.example`.
3. Conferir as variaveis obrigatorias:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CHAT_STREAM_FILE_HOSTS`
4. Subir o container:

```bash
docker compose --env-file .env up -d --build
```

5. Validar:

```bash
docker compose ps
docker network inspect nexus-hermes-net
curl -I https://chat.solucoes-nexus.tech
```

Resultado esperado:

- frontend abre via HTTPS;
- Traefik emite certificado;
- container fica healthy;
- rede `nexus-hermes-net` existe.

## Fase 2: Criar o Nexus Hermes Bridge

Criar um novo servico backend na VPS, em compose separado ou no mesmo compose do app, preferencialmente em compose separado para manter responsabilidades claras.

Nome sugerido:

```text
nexus-hermes-bridge
```

Decisao atual:

```text
O bridge foi colocado no mesmo compose do frontend, dentro do projeto app-nexus-ai.
```

Servicos atuais:

```text
app-nexus-ai
  - app-nexus-ai-frontend
  - app-nexus-ai-bridge
```

Dominio do frontend:

```text
https://chat.solucoes-nexus.tech
```

Dominio da bridge:

```text
https://chat-api.solucoes-nexus.tech
```

Responsabilidades:

- autenticar chamadas vindas do frontend;
- validar usuario/token Supabase;
- criar runs no Hermes;
- persistir `run_id`, `chat_session_id`, `status`, `created_at`, `updated_at`;
- acompanhar execucao longa;
- coletar resposta final;
- coletar arquivos/imagens gerados;
- gravar resultado no Supabase ou expor para o frontend buscar;
- permitir reconexao depois de refresh/queda de aba.

Endpoints iniciais:

```text
POST /chat/runs
GET  /chat/runs/:id
GET  /chat/runs/:id/events
POST /chat/runs/:id/cancel
```

Endpoints implementados na primeira versao:

```text
GET  /health
POST /api/chat/stream
POST /api/chat/runs
GET  /api/chat/runs/:id
GET  /api/chat/runs/:id/events
```

`POST /api/chat/stream` existe para manter compatibilidade com o frontend atual. Ele cria um run na bridge, chama o Hermes API Server e reemite eventos SSE no formato que a interface ja entende.

`POST /api/chat/runs` e `GET /api/chat/runs/:id/events` preparam a migracao para o fluxo realmente assincrono, onde o frontend podera reconectar em runs longos mesmo depois de refresh ou queda de aba.

## Como Conectar a Bridge ao Hermes

A bridge ainda usa o Hermes API Server. Ela nao substitui o Hermes Agent.

Papel de cada componente:

```text
Frontend: interface do usuario
Bridge: orquestracao persistente e entrega de eventos
Hermes API Server: agente real, memoria, skills, tools, runs e sessions
```

Configure no `.env` do compose:

```env
VITE_CHATBOT_PROXY_URL=https://chat-api.solucoes-nexus.tech
NEXT_PUBLIC_CHATBOT_PROXY_URL=https://chat-api.solucoes-nexus.tech

HERMES_API_BASE_URL=http://NOME_DO_SERVICO_HERMES:PORTA
HERMES_API_KEY=SUA_CHAVE_SE_O_HERMES_EXIGIR
```

Se o compose do Hermes estiver separado, conecte ele na rede compartilhada:

```yaml
networks:
  nexus-hermes-net:
    external: true

services:
  hermes:
    networks:
      - nexus-hermes-net
```

Depois use o nome do servico Hermes como host. Exemplo, se o servico se chama `hermes-api` e escuta na porta `8000`:

```env
HERMES_API_BASE_URL=http://hermes-api:8000
```

Tambem e possivel usar a URL publica atual do Hermes:

```env
HERMES_API_BASE_URL=https://api.hermes-seu-dominio.com
```

Mas a URL interna Docker e preferivel porque evita sair pela internet, TLS/proxy externo e possiveis limites de reverse proxy entre a bridge e o Hermes.

## Fase 3: Modelo Assincrono de Runs

Criar uma tabela para rastrear trabalhos longos do Hermes.

Tabela sugerida:

```text
chat_hermes_runs
```

Campos sugeridos:

- `id`
- `user_id`
- `chat_session_id`
- `hermes_session_id`
- `hermes_run_id`
- `status`
- `input`
- `output_text`
- `error_code`
- `error_message`
- `files_json`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

Estados sugeridos:

```text
queued
running
tool_running
completed
failed
cancelled
expired
```

## Fase 4: Integracao do Frontend com a Bridge

Alterar gradualmente o frontend para trocar o envio direto via stream por um fluxo de job.

Fluxo alvo:

1. Usuario envia mensagem.
2. Frontend salva mensagem do usuario no chat.
3. Frontend chama `POST /chat/runs`.
4. Backend retorna `run_id` imediatamente.
5. Frontend mostra mensagem temporaria:

```text
Hermes esta trabalhando...
```

6. Frontend acompanha status via polling ou SSE proprio.
7. Quando o run termina, frontend renderiza texto, imagens e arquivos.
8. Se o usuario der refresh, o frontend carrega runs pendentes daquele chat e continua acompanhando.

## Fase 5: Arquivos, Imagens e Previews

O Hermes deve continuar hospedando arquivos gerados em URL publica ou assinada. A bridge deve normalizar os arquivos para um formato unico:

```json
{
  "name": "arquivo.png",
  "url": "https://...",
  "kind": "image",
  "mimeType": "image/png"
}
```

O frontend ja deve conseguir:

- renderizar preview de imagens publicas permitidas;
- exibir cards de arquivos;
- baixar arquivos;
- copiar link;
- abrir arquivo em nova aba quando necessario.

## Fase 6: Observabilidade

Adicionar logs por fronteira:

- frontend criou run;
- bridge recebeu run;
- bridge chamou Hermes;
- Hermes retornou `run_id`;
- bridge recebeu evento;
- bridge persistiu status;
- bridge entregou resposta final;
- frontend renderizou resposta.

Cada run deve ter um identificador correlacionavel:

```text
nexus_run_id
chat_session_id
hermes_run_id
request_id
```

## Fase 7: Tolerancia a Falhas

Casos que a arquitetura precisa suportar:

- usuario fecha aba durante execucao;
- usuario atualiza pagina;
- conexao SSE cai;
- Hermes demora 20+ minutos;
- ferramenta do Hermes falha;
- Hermes gera arquivo mas nao gera texto;
- Hermes gera texto mas nao gera arquivo;
- bridge reinicia;
- VPS reinicia;
- run fica preso.

Comportamento esperado:

- o run nao some;
- o status fica consultavel;
- erro real e exibido quando existir;
- o usuario pode tentar novamente;
- o historico do chat nao fica corrompido.

## Fase 8: Migracao Gradual

1. Manter a Supabase Function atual funcionando como fallback.
2. Subir frontend na VPS.
3. Subir bridge na VPS.
4. Testar bridge com um chat de desenvolvimento.
5. Alterar `VITE_CHATBOT_PROXY_URL` para apontar para a bridge.
6. Validar:
   - mensagem simples;
   - tarefa longa;
   - uso de browser/tool;
   - geracao de imagem;
   - preview de imagem;
   - arquivo PDF/TXT;
   - refresh durante execucao.
7. Depois de estabilizar, aposentar a Supabase Edge Function como caminho principal.

## Decisao Recomendada

Usar a Supabase Edge Function apenas como transicao. Para o Hermes Agent pesado, o caminho final deve ser:

```text
Frontend Docker na VPS ou Vercel
  -> Nexus Hermes Bridge na VPS
    -> Hermes API Server local/rede Docker
```

Essa arquitetura combina melhor com o perfil do Hermes: agente com memoria, skills, tools, browser, terminal, arquivos, imagem e tarefas longas.
