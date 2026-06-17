cd /opt/projeto-ens

# 1- ajeitar nano .env

# 2- docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/projeto-ens-compose.yml

# 3 - usar os comandos abaixo, subir do zero:
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps

# 4 - para atualizar o atual projeto:
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
