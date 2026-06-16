#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p \
  data/hermes/skills \
  data/hermes/cron \
  data/hermes/plugins \
  data/bridge \
  data/designer/outputs \
  data/designer/tmp \
  data/designer/temp/uploads \
  logs

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Criado: $ROOT/.env — preencha os valores reais antes de subir serviços dependentes de secrets."
else
  echo "Mantido: $ROOT/.env"
fi

if [ ! -f data/hermes/config.yaml ]; then
  cp infra/hermes/config.yaml data/hermes/config.yaml
  echo "Criado: $ROOT/data/hermes/config.yaml"
else
  echo "Mantido: $ROOT/data/hermes/config.yaml"
fi

chmod +x scripts/**/*.sh scripts/*.sh 2>/dev/null || true

echo "Bootstrap concluído em: $ROOT"
