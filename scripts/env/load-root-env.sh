#!/usr/bin/env bash
# Source this file from service scripts to load the single root .env.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJETO_ENS_ENV_FILE:-$PROJECT_ROOT/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: env central não encontrada: $ENV_FILE" >&2
  echo "Rode: cp .env.example .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export PROJETO_ENS_ROOT="$PROJECT_ROOT"
export PATH="$PROJECT_ROOT/.tools:$PATH"
