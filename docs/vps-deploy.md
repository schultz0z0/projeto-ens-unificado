# Deploy VPS Hostinger

Fluxo recomendado para uma VPS limpa.

## 1. Preparar pasta

```bash
sudo mkdir -p /opt/projeto-ens-unificado
sudo chown -R "$USER:$USER" /opt/projeto-ens-unificado
cd /opt/projeto-ens-unificado
```

Se preferir clonar criando a pasta automaticamente:

```bash
cd /opt
git clone https://github.com/schultz0z0/projeto-ens-unificado.git projeto-ens-unificado
cd projeto-ens-unificado
```

## 2. Bootstrap

Use `bash` diretamente. Assim o bootstrap funciona mesmo se o bit executavel do arquivo ainda nao estiver aplicado no checkout.

```bash
bash scripts/bootstrap.sh
```

Se aparecer permissao negada durante criacao de `data/` ou `logs/`, ajuste o dono da pasta do projeto e rode de novo:

```bash
sudo chown -R "$USER:$USER" .
bash scripts/bootstrap.sh
```

## 3. Configurar ambiente

Edite `.env` e troque os valores `CHANGE_ME`/URLs locais pelos valores reais de producao.

Pontos obrigatorios para producao:

- `NEXUS_PUBLIC_CHATBOT_PROXY_URL=https://bridge.seu-dominio`
- `NEXUS_PUBLIC_DESIGNER_API_URL=https://designer.seu-dominio`
- `NEXUS_PUBLIC_ARTIFACT_URL=https://arquivos.seu-dominio`
- `NEXUS_PUBLIC_CHAT_STREAM_FILE_HOSTS=app.seu-dominio,bridge.seu-dominio,designer.seu-dominio,arquivos.seu-dominio`
- `NEXUS_CHAT_ALLOWED_ORIGINS=https://app.seu-dominio`
- `NEXUS_DESIGNER_ALLOWED_ORIGINS=https://app.seu-dominio`
- `NEXUS_ARTIFACT_ALLOWED_ORIGINS=https://app.seu-dominio`
- `NEXUS_HERMES_API_KEY=<segredo-forte>`
- `NEXUS_ARTIFACT_INTERNAL_KEY=<segredo-forte>`
- `NEXUS_ARTIFACT_ACCESS_TOKEN_SECRET=<segredo-forte>`
- chaves reais de Supabase e provedores de IA usados pelos servicos

O Artifact Server local guarda arquivos privados em `data/artifacts` e publica somente links assinados curtos pelo dominio `NEXUS_PUBLIC_ARTIFACT_URL`. O limite operacional inicial por arquivo/artifact individual e `NEXUS_ARTIFACT_MAX_UPLOAD_BYTES=5368709120` (5 GiB), pensado para imagens, videos e projetos zipados grandes; isso nao define cota total do storage local. Esse mesmo valor e repassado ao Hermes como `HERMES_ARTIFACT_MAX_BYTES`, para limitar cada arquivo stageado antes do Bridge importar. O Traefik continua em compose separado; este projeto apenas adiciona labels Docker para o host `NEXUS_PUBLIC_ARTIFACT_HOST`.

O handoff Hermes -> Bridge usa `data/hermes-artifacts`: o `api_server` do fork do Hermes baixa/copia outputs de tools para `NEXUS_HERMES_ARTIFACTS_DIR` (`/opt/data/nexus-artifacts`) e emite esse caminho local nos eventos `tool.completed`; o Bridge le o mesmo bind mount em `NEXUS_BRIDGE_HERMES_ARTIFACTS_DIR` (`/app/data/hermes-artifacts`) para importar o arquivo ao Artifact Server.

Para o modo legado de imagem via Supabase, enquanto algum tool do Hermes ainda nao emitir arquivos para o Artifact Server, o Supabase do app tambem precisa destas variaveis:

- `NEXUS_SUPABASE_OUTPUTS_BUCKET=image-gen-outputs`
- `NEXUS_SUPABASE_GENERATED_IMAGES_PREFIX=hermes-chat-images`
- `NEXUS_SUPABASE_SIGNED_URL_EXPIRES_SECONDS=3600`
- `NEXUS_HERMES_IMAGE_SUPABASE_DELETE_LOCAL_CACHE=true`

Aplique no SQL Editor do Supabase do app a migration:

```text
apps/chat-web/supabase/migrations/20260618123000_image_gen_outputs_storage.sql
```

## 4. Build e start

Use sempre os dois arquivos Compose em producao, porque `docker-compose.prod.yml` adiciona as labels do Traefik.

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 5. Diagnostico rapido

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps -a
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 hermes-api designer-api artifact-server app-bridge app-frontend hermes-kanban
```
