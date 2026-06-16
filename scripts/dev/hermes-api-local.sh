#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ ! -x "$ROOT/services/hermes-runtime/.venv/bin/hermes" ]; then
  bash "$ROOT/scripts/dev/hermes-install.sh"
fi
# shellcheck disable=SC1091
source "$ROOT/scripts/dev/hermes-env-local.sh"

cd "$HERMES_HOME"
echo "Hermes API local: http://127.0.0.1:${API_SERVER_PORT}/health"
echo "HERMES_HOME=$HERMES_HOME"
exec "$HERMES_DEV_VENV/bin/hermes" gateway run
