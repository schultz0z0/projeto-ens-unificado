# Hermes Core vendorizado no projeto-ens-unificado

Este monorepo inclui o código-fonte do Hermes Agent em:

```text
services/hermes-runtime/vendor/hermes-agent
```

Objetivo:

- editar/customizar o core do Hermes dentro do próprio projeto;
- validar localmente no Ubuntu/WSL;
- futuramente enviar o repositório para GitHub;
- na VPS Hostinger, rodar `docker compose build` para construir a imagem Hermes usando esse source local, não o pacote PyPI.

## Local WSL sem Docker Compose para Hermes

Instalar toolchain local do Hermes:

```bash
cd /home/nexusai/projeto-ens-unificado
bash scripts/dev/hermes-install.sh
```

Rodar API Hermes local:

```bash
bash scripts/dev/hermes-api-local.sh
```

Rodar dashboard Hermes local em outro terminal:

```bash
bash scripts/dev/hermes-dashboard-local.sh
```

Health/API:

```bash
curl http://127.0.0.1:8652/health
```

Dashboard:

```text
http://127.0.0.1:9119
```

## Futuro build na VPS

O Dockerfile do Hermes está em:

```text
services/hermes-runtime/docker/hermes.Dockerfile
```

Ele copia o source local:

```dockerfile
COPY vendor/hermes-agent /opt/hermes-src
```

E instala:

```dockerfile
pip install -e "/opt/hermes-src[web,pty]"
```

Comando futuro na VPS:

```bash
docker compose --env-file .env build hermes-api hermes-kanban
docker compose --env-file .env up -d
```

## Não versionar

Não subir para GitHub:

```text
.env
data/
.tools/
services/hermes-runtime/.venv/
node_modules/
dist/
build/
logs/
outputs/
tmp/
```

Esses caminhos estão no `.gitignore`.
