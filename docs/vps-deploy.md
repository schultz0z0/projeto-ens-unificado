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
- `NEXUS_PUBLIC_CHAT_STREAM_FILE_HOSTS=app.seu-dominio,bridge.seu-dominio,designer.seu-dominio`
- `NEXUS_CHAT_ALLOWED_ORIGINS=https://app.seu-dominio`
- `NEXUS_DESIGNER_ALLOWED_ORIGINS=https://app.seu-dominio`
- `NEXUS_HERMES_API_KEY=<segredo-forte>`
- chaves reais de Supabase e provedores de IA usados pelos servicos

## 4. Build e start

Use sempre os dois arquivos Compose em producao, porque `docker-compose.prod.yml` adiciona as labels do Traefik.

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 5. Diagnostico rapido

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps -a
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 hermes-api designer-api app-bridge app-frontend hermes-kanban
```
