# Servidor-LLM-v2 — Hermes Agent VPS Linux

Este projeto está preparado para hospedar, em uma VPS Linux/Hostinger, apenas:

- **Hermes Agent / Hermes API Server** em `api-hermes.solucoes-nexus.tech`
- **Hermes Kanban Dashboard nativo** em `hermes.solucoes-nexus.tech`

O Traefik **continua sendo o proxy público**. O compose assume que já existe um Traefik funcionando na VPS e que os domínios abaixo não vão mudar:

```text
api-hermes.solucoes-nexus.tech  -> Hermes API Server
hermes.solucoes-nexus.tech      -> Hermes Kanban Dashboard
```

Não usamos mais neste projeto:

- Hermes workspace separado
- Open WebUI
- Paperclip
- Postgres do Paperclip
- SearXNG
- profiles extras do Hermes
- RAG MCP neste momento
- migração automática de arquivos Windows -> Linux

A VPS é Linux. Portanto, tudo que rodar lá deve usar paths Linux/container:

```text
/opt/data
/opt/data/skills
```

---

## Estrutura atual

```text
.
├── docker-compose.yml
├── .env.example
├── docker/
│   ├── hermes.Dockerfile
│   ├── hermes-api-server.sh
│   ├── hermes-init.sh
│   └── hermes-kanban-dashboard.sh
├── scripts/
│   └── bootstrap-linux-hermes-data.sh
├── templates/
│   └── hermes/
│       └── config.yaml
├── sync-config.sh
└── data/                  # gerado na VPS / ignorado pelo git
```

---

## Fluxo desejado via SSH

A ideia operacional agora é:

```text
Hermes Desktop local Windows
        ↓ conversa/controle via SSH
VPS Linux Hostinger
        ↓
Hermes base + API Server + Kanban
        ↓
skills/tools/MCP configurados depois diretamente na VPS via SSH
```

Não faremos mais cópia automática de arquivos do Windows para Linux. Quando precisarmos de skills, tools ou MCPs, vamos configurar de forma controlada na VPS via SSH.

Não migramos nesta fase:

- sessions antigas
- memória bruta
- `auth.json`
- profiles extras
- secrets versionados
- paths Windows
- RAG MCP

---

## Bootstrap inicial na VPS Linux

Na VPS:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates apache2-utils
```

Se Docker ainda não estiver instalado, instalar Docker/Compose conforme o padrão da VPS. Depois:

```bash
cd /opt
sudo mkdir -p nexus-hermes
sudo chown -R "$USER:$USER" nexus-hermes
cd /opt/nexus-hermes
```

Copie ou clone o projeto para essa pasta. Em seguida:

```bash
chmod +x scripts/*.sh docker/*.sh
./scripts/bootstrap-linux-hermes-data.sh
cp .env.example .env
nano .env
nano data/hermes/config.yaml
docker compose up -d --build
```

Validar localmente na VPS:

```bash
docker compose ps
curl http://127.0.0.1:8652/health
curl http://127.0.0.1:9119/
```

Validar via Traefik/domínios:

```bash
curl https://api-hermes.solucoes-nexus.tech/health
curl https://hermes.solucoes-nexus.tech/
```

---

## Traefik

O compose conecta `hermes-api` e `hermes-kanban` à rede externa:

```env
TRAEFIK_NETWORK=traefik
```

Se a rede do seu Traefik tiver outro nome, descubra na VPS:

```bash
docker network ls
```

E ajuste no `.env`:

```env
TRAEFIK_NETWORK=nome_da_rede_do_traefik
```

O API Server fica em:

```env
HERMES_API_SUBDOMAIN=api-hermes.solucoes-nexus.tech
```

O Kanban fica em:

```env
HERMES_KANBAN_SUBDOMAIN=hermes.solucoes-nexus.tech
```

Para proteger o Kanban com Basic Auth via Traefik:

```bash
htpasswd -nbB admin 'sua-senha' | sed -e 's/\$/\$\$/g'
```

Copie o usuário e hash para:

```env
HERMES_KANBAN_AUTH_USER=admin
HERMES_KANBAN_AUTH_PASSWORD_HASH=hash_aqui
```

---

## Dependências instaladas pela imagem Hermes

`docker/hermes.Dockerfile` parte da imagem Hostinger Hermes e instala/garante:

- Hermes Agent atualizado com extras `web` e `pty`
- Python/pip/venv
- Node/npm/npx para futuros MCPs JavaScript
- `uv` para futuros MCPs Python
- MCP SDK Python
- Chromium e Playwright
- curl/git/build tools
- `tini` para init correto em container

A intenção é imitar o comportamento “bateria incluída” do Hermes Desktop para a VPS Linux.

---

## Configuração posterior via SSH

Depois que o Hermes base estiver no ar, faremos via SSH:

```bash
cd /opt/nexus-hermes
nano data/hermes/config.yaml
docker compose restart hermes-api hermes-kanban
```

Para entrar no container e usar os comandos do Hermes:

```bash
docker compose exec hermes-api bash
hermes setup
hermes model
hermes tools
hermes skills list
```

Quando formos adicionar MCPs no futuro, configuraremos `mcp_servers` diretamente em `data/hermes/config.yaml` na VPS e reiniciaremos os serviços.

---

## Segurança

- Nunca versionar `.env` real.
- Nunca colocar senha/API key real na documentação.
- Manter `data/` ignorado pelo git.
- Usar SSH para configurar a VPS de forma controlada.
- Trocar `HERMES_API_KEY_CORE` antes de expor a API.
- Proteger o Kanban via Basic Auth no Traefik.
- Adicionar MCPs somente quando formos configurar o serviço correspondente.
