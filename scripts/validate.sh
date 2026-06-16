#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Projeto ENS monorepo validation =="

required=(
  "apps/chat-web/package.json"
  "services/chat-bridge/package.json"
  "services/rag-mcp/package.json"
  "services/hermes-runtime/docker/hermes.Dockerfile"
  "apps/designer-api/requirements.txt"
  "apps/designer-api/api/app.py"
  ".env.example"
  "docker-compose.yml"
)
for f in "${required[@]}"; do
  if [ ! -e "$f" ]; then
    echo "ERRO: ausente: $f" >&2
    exit 1
  fi
done

nested_git_count=$(find apps services packages infra scripts docs -name .git -print | wc -l | tr -d ' ')
if [ "$nested_git_count" != "0" ]; then
  echo "ERRO: existem .git internos:" >&2
  find apps services packages infra scripts docs -name .git -print >&2
  exit 1
fi

echo "OK: sem .git internos"

bash -n scripts/bootstrap.sh scripts/env/load-root-env.sh scripts/dev/*.sh scripts/validate.sh scripts/docker/*.sh 2>/dev/null || {
  echo "ERRO: falha em bash -n nos scripts" >&2
  exit 1
}
echo "OK: scripts shell sintaticamente válidos"

if command -v docker >/dev/null 2>&1; then
  docker compose --env-file .env.example config >/tmp/projeto-ens-compose-config.yaml
  echo "OK: docker compose config válido (/tmp/projeto-ens-compose-config.yaml)"
  echo "Serviços:"
  docker compose --env-file .env.example config --services
else
  echo "AVISO: docker não encontrado; pulando validação de compose"
fi

echo "Validação concluída."
