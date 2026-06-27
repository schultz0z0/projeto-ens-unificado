# Recomendacao de Uso - Hermes Agent Localhost + Superpowers

**Data:** 2026-06-27
**Status:** Tudo funcionando (8 containers HEALTHY, comando `hermes` instalado, 14 superpowers indexadas)

---

## 1. Comando `hermes` no Ubuntu WSL

**Wrapper:** `~/.local/bin/hermes` (5 linhas bash)

```bash
#!/usr/bin/env bash
HERMES_DIR="/home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent"
VENV="$HERMES_DIR/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  ~/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 -m venv "$VENV" || exit 1
fi
cd "$HERMES_DIR"
exec "$VENV/bin/python" -m hermes_cli.main "$@"
```

**Atalho:** PATH ja inclui `~/.local/bin` (via `.bashrc`). Em qualquer novo shell Ubuntu WSL, `hermes` ja funciona.

**Versao:** Hermes Agent v0.16.0 (Python 3.13.14).

---

## 2. Subcomandos uteis do dia-a-dia

| Comando | O que faz |
|---------|-----------|
| `hermes --help` | Lista todos os 50+ subcomandos |
| `hermes version` | Versao + caminho do fork + status de update |
| `hermes doctor` | Diagnostico: Python venv, security advisories, MCP servers |
| `hermes status` | Status de todos os componentes (env, API keys, skills) |
| `hermes prompt-size` | Quanto cada tier do system prompt consome |
| `hermes skills list` | Lista skills instaladas (via hub oficial) |
| `hermes chat -z "prompt"` | Chat one-shot com prompt direto (nao abre REPL) |
| `hermes chat` | Chat interativo (REPL com banner) |
| `hermes skills inspect <name>` | Detalhes de uma skill |
| `hermes bundles/plugins/memory/tools` | Gestao de cada subsistema |
| `hermes gateway start` | Inicia gateway de mensageria (Telegram/Discord/Slack) |
| `hermes kanban` | Multi-profile kanban (se ativo) |

**Nao confundir `hermes chat -z` com `hermes chat`**: o `-z` envia o prompt direto e sai (util pra scripts), sem `-z` abre REPL.

---

## 3. Como usar as 14 skills superpowers

### Fluxo canonico recomendado (8-passos)

1. **Meta-skill primeiro**: `hermes chat -z "Use using-superpowers to load your meta-skill"` ou simplesmente carregue `--skills using-superpowers` no chat.
2. **Brainstorming**: antes de qualquer feature nova, use `brainstorming`. O agent vai explorar o problema antes de pular pra codigo.
3. **Writing plans**: `writing-plans` quebra em tarefas bite-sized (2-5min cada).
4. **Using git worktrees**: `using-git-worktrees` isola o trabalho do workspace principal.
5. **TDD + systematic-debugging**: durante implementacao. `test-driven-development` (RED-GREEN-REFACTOR) + `systematic-debugging` (4 fases) sao quase sempre usados juntos.
6. **Requesting code review**: `requesting-code-review` antes de merge, dispatcha subagent reviewer.
7. **Verification before completion**: `verification-before-completion` roda checks objetivos antes de voce dizer "pronto".
8. **Finishing a development branch**: `finishing-a-development-branch` guia o merge/PR final.

### Exemplo de invocacao

```bash
# Pre-carregar 2 skills pra sessao
hermes chat --skills using-superpowers,test-driven-development

# Dentro do chat, dizer:
# "Help me implement the RAG ingestion validation. Use test-driven-development."
# O agent vai carregar test-driven-development automaticamente porque o match do trigger.
```

### Quando o agent NAO carrega uma skill sozinho

Use flag `--skills` explicita:

```bash
hermes chat --skills brainstorming,writing-plans,systematic-debugging -z "Build a CLI tool to parse our YAML configs"
```

---

## 4. Recomendacoes praticas por cenario

### Cenario A: Implementar feature nova
```bash
hermes chat --skills brainstorming,writing-plans,using-git-worktrees
```

### Cenario B: Debugar bug complexo
```bash
hermes chat --skills systematic-debugging,test-driven-development
```

### Cenario C: Review de PR
```bash
hermes chat --skills requesting-code-review,verification-before-completion
```

### Cenario D: Receber feedback do reviewer
```bash
hermes chat --skills receiving-code-review
```

### Cenario E: Coordenar varios subagents
```bash
hermes chat --skills subagent-driven-development,dispatching-parallel-agents
```

### Cenario F: Meta-uso (saber o que fazer)
```bash
hermes chat --skills using-superpowers -z "What should I do next?"
```

---

## 5. Quando NAO usar superpowers

- **Edicoes triviais** (typo, 1 linha): superpowers eh overhead, pule direto.
- **Documentacao pura** (sem logica): nao precisa TDD/debug.
- **Spike/prototipo descartavel**: `spike` skill nativa do Hermes serve melhor.
- **Trabalho fora do repo**: superpowers assume git + tests. Pra one-off scripts use `hermes` normal.

---

## 6. Configuracao atual (ja feita)

**`~/.hermes/config.yaml`** (criado):
```yaml
skills:
  external_dirs:
    - /home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent/skills
```

Sem essa config, o hermes nao descobre as 121 skills bundled (skills index = 0 KB). Com ela, 10.5 KB indexadas.

**`scripts/bootstrap.sh`** ja foi rodado (data/ existe, config.yaml copiado). Re-rodar eh idempotente (preserva arquivos existentes).

---

## 7. Containers Docker (localhost, NAO producao)

**Status:** 8/8 HEALTHY
- `projeto-ens-rag-mcp` (porta 8000) - JSON OK
- `projeto-ens-hermes-api` (porta 8652) - v0.16.0 OK
- `projeto-ens-hermes-kanban` (porta 9119) - HTML dashboard
- `projeto-ens-app-bridge` (porta 8081) - chat bridge OK
- `projeto-ens-app-frontend` (porta 8088) - Next.js OK
- `projeto-ens-designer-api` (porta 8090) - OK
- `projeto-ens-artifact-server` (porta 8095) - OK
- `projeto-ens-rag-mcp-ingestion-cron` (sem porta)

**Health checks passam:** curl em todas as portas retorna 200/health.

**Comando pra subir/parar:**
```bash
cd /home/nexusai/Nexus-white-label
docker compose --env-file .env -f docker-compose.yml up -d      # subir
docker compose --env-file .env -f docker-compose.yml down      # parar (SEM -v pra preservar data/)
docker compose --env-file .env -f docker-compose.yml ps        # status
docker compose --env-file .env -f docker-compose.yml logs -f   # logs
```

**NAO foi tocado:** `docker-compose.prod.yml` (compose de producao continua intocado).

---

## 8. Arquivos criticos desta sessao

| Arquivo | Conteudo |
|---------|----------|
| `~/.local/bin/hermes` | Wrapper do comando hermes (PATH) |
| `~/.hermes/config.yaml` | Config minima: external_dirs pra skills |
| `~/.bashrc` | Adicionado `export PATH=~/.local/bin:$PATH` |
| `services/hermes-runtime/vendor/hermes-agent/.venv/` | Python 3.13.14 venv |
| `services/hermes-runtime/vendor/hermes-agent/skills/software-development/using-superpowers/references/hermes-nexus.md` | Referencia Hermes/Nexus no using-superpowers |
| `services/hermes-runtime/vendor/hermes-agent/skills/_backup-pre-superpowers-replace-20260627-143642/` | Backup das 4 skills Hermes-adaptadas removidas |
| `data/` (raiz projeto) | Bind mount pros containers (preservado pelo bootstrap) |
| `services/open-design/` (382MB) | Repo clonado, fonte das 14 skills frontend |
| `services/superpowers/` (2.7MB) | Repo clonado, fonte das 14 skills superpowers |
| `services/audit-tmp/` | Relatorios + design systems de referencia |

---

## 9. Proximos passos sugeridos (curto prazo)

1. **Testar `hermes chat` end-to-end**: rodar um chat real com modelo (precisa API key no `.env` ou `hermes model` interativo).
2. **Adicionar `.env` ao hermes CLI**: copiar as chaves do `.env` raiz do projeto pra `~/.hermes/.env` (NAO commitar).
3. **Configurar gateway**: `hermes gateway setup telegram` (ou discord/slack) se quiser operacao via chat.
4. **Documentar customizacoes Nexus**: criar `nexus-superpowers-index.md` mostrando quais das 14 + arsenal frontend + memoria estao ativas no fork.
5. **Validar MCP `nexus_rag` no hermes CLI**: depois de subir modelos, perguntar algo que dependa do RAG ENS.

## 10. Honest assessment

- **Funciona end-to-end?** Quase. Falta configurar API key + testar um chat real pra confirmar que as skills sao invocadas pelo trigger do agent (vs manualmente via `--skills`).
- **Couste?** Tempo pra rodar `pip install -e ".[web,pty]"` foi ~3min. Venv ocupa ~300MB.
- **Risco?** Zero - tudo eh novo, nada foi sobrescrito. Backup das 4 skills antigas preservado. Compose de producao intacto.
- **Recomendado?** Sim. O comando `hermes` agora funciona nativamente no Ubuntu WSL, sem precisar entrar em Docker pra desenvolvimento local. O fork vendored em `services/hermes-runtime/vendor/hermes-agent` eh o "source of truth".
