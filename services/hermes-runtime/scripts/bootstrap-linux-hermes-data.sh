#!/usr/bin/env bash
set -euo pipefail

# Prepare the portable Hermes data layout used by the monorepo Docker Compose
# and local WSL development scripts. Run from anywhere inside the checked-out
# projeto-ens-unificado tree.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HERMES_RUNTIME="$PROJECT_ROOT/services/hermes-runtime"
HERMES_DATA="$PROJECT_ROOT/data/hermes"

mkdir -p \
  "$HERMES_DATA/skills" \
  "$HERMES_DATA/cron" \
  "$HERMES_DATA/plugins" \
  "$HERMES_DATA/logs" \
  "$HERMES_DATA/sessions"

if [ ! -f "$HERMES_DATA/config.yaml" ]; then
  cp "$HERMES_RUNTIME/templates/hermes/config.yaml" "$HERMES_DATA/config.yaml"
  echo "Created $HERMES_DATA/config.yaml from template."
else
  echo "Keeping existing $HERMES_DATA/config.yaml"
fi

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
  echo "Created $PROJECT_ROOT/.env from .env.example. Edit it before production."
else
  echo "Keeping existing $PROJECT_ROOT/.env"
fi

chmod +x "$HERMES_RUNTIME"/docker/*.sh "$HERMES_RUNTIME"/scripts/*.sh "$PROJECT_ROOT"/scripts/**/*.sh 2>/dev/null || true

echo "Hermes data layout ready: $HERMES_DATA"
echo "Local dev install: bash scripts/dev/hermes-install.sh"
echo "VPS build later: docker compose --env-file .env build hermes-api hermes-kanban"
