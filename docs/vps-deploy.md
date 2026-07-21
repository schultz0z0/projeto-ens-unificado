# Deploy na VPS

Fluxo de atualização do monorepo em produção, incluindo o Picture-Hermes. O
Picture substitui o Designer API na página Geração de Imagem, mas permanece
exclusivamente na rede Docker interna. O chat normal continua usando o
`image_generate` padrão do Hermes.

## 1. Preparar ou atualizar o checkout

Em uma VPS limpa:

```bash
sudo mkdir -p /opt/projeto-ens-unificado
sudo chown -R "$USER:$USER" /opt/projeto-ens-unificado
git clone https://github.com/schultz0z0/projeto-ens-unificado.git /opt/projeto-ens-unificado
cd /opt/projeto-ens-unificado
bash scripts/bootstrap.sh
```

Em uma instalação existente, preserve antes o commit atual e avance somente em
fast-forward:

```bash
cd /opt/projeto-ens-unificado
git tag "pre-picture-hermes-$(date +%Y%m%d-%H%M%S)" "$(git rev-parse HEAD)"
git pull --ff-only
bash scripts/bootstrap.sh
```

Se o projeto estiver em `/opt/projeto-ens`, use esse caminho sem mover os dados
existentes.

## 2. Configurar o ambiente

Não substitua o `.env` real pela `.env.example`. Compare os nomes e preencha no
arquivo real os valores novos. O contrato completo está em `.env.example`.

Variáveis obrigatórias do runtime Picture:

```env
NEXUS_SUPABASE_DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@SESSION_POOLER:5432/postgres
NEXUS_PICTURE_INTERNAL_URL=http://picture-it:8090
NEXUS_PICTURE_INTERNAL_KEY=<segredo-aleatorio-com-32-ou-mais-caracteres>
NEXUS_PICTURE_FAL_KEY=<fal-key-real>
NEXUS_PICTURE_MCP_URL=http://picture-it:8090/mcp
NEXUS_PICTURE_DELEGATION_ACTIVE_KID=v1
NEXUS_PICTURE_DELEGATION_ACTIVE_KEY=<segredo-aleatorio-com-32-ou-mais-caracteres>
NEXUS_PICTURE_DELEGATION_PREVIOUS_KID=
NEXUS_PICTURE_DELEGATION_PREVIOUS_KEY=
```

Use a URL do Session Pooler IPv4 do Supabase na porta 5432. Não exponha a
`FAL_KEY`, service role, chave interna ou chaves de delegação ao browser.

URLs e origens públicas:

```env
NEXUS_PUBLIC_CHAT_WEB_URL=https://app.seu-dominio
NEXUS_PUBLIC_CHATBOT_PROXY_URL=https://bridge.seu-dominio
NEXUS_PUBLIC_ARTIFACT_URL=https://arquivos.seu-dominio
NEXUS_PUBLIC_CHAT_STREAM_FILE_HOSTS=app.seu-dominio,bridge.seu-dominio,arquivos.seu-dominio
NEXUS_CHAT_ALLOWED_ORIGINS=https://app.seu-dominio
NEXUS_ARTIFACT_ALLOWED_ORIGINS=https://app.seu-dominio
```

O Picture não tem host público, porta publicada ou CORS de browser. O acesso é
browser → Bridge autenticada → Picture/Artifact Server internos.

O Artifact Server guarda arquivos privados em `data/artifacts` e publica links
assinados curtos. O handoff Hermes → Bridge usa `data/hermes-artifacts`.

## 3. Aplicar as migrations Supabase

Com o Supabase CLI disponível e a mesma URL de banco do `.env`:

```bash
cd apps/chat-web
npx supabase migration list --db-url "$NEXUS_SUPABASE_DATABASE_URL"
npx supabase db push --db-url "$NEXUS_SUPABASE_DATABASE_URL"
cd ../..
```

Confirme que `20260721190000_picture_hermes_workspace.sql` aparece em local e
remoto. A migration é aditiva; não remova tabelas ou dados legados no deploy.

O bucket privado `image-gen-outputs` e a migration
`20260618123000_image_gen_outputs_storage.sql` continuam necessários apenas
para o gerador padrão do chat normal.

## 4. Validar e subir os containers

Use sempre os dois arquivos Compose em produção:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build artifact-server picture-it hermes-api app-bridge app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

O `--remove-orphans` remove o container antigo do Designer API, se ainda existir;
ele não apaga volumes ou diretórios de dados.

## 5. Verificações pós-deploy

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps -a
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 picture-it artifact-server hermes-api app-bridge app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T picture-it curl -fsS http://127.0.0.1:8090/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T picture-it curl -fsS http://127.0.0.1:8090/ready
```

Valide depois o fluxo manual completo em
[`docs/picture-hermes-operations.md`](picture-hermes-operations.md), incluindo
reload, aprovação, cancelamento/confirmação de Criar nova peça e Trabalhos
Validados.

## 6. Rollback sem perda de dados

Volte somente o código para a tag criada antes do deploy e reconstrua. Não
reverta migrations aditivas e não apague `data/artifacts`, `data/hermes` nem
registros `picture_*`/`validated_works`.

```bash
git switch --detach <tag-pre-picture-hermes>
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

O guia de saúde, fila, rotação de chaves e smoke FAL opt-in está em
[`docs/picture-hermes-operations.md`](picture-hermes-operations.md).
