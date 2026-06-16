#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ ! -x "$ROOT/services/hermes-runtime/.venv/bin/hermes" ]; then
  bash "$ROOT/scripts/dev/hermes-install.sh"
fi
# shellcheck disable=SC1091
source "$ROOT/scripts/dev/hermes-env-local.sh"

cd "$HERMES_HOME"
"$HERMES_DEV_VENV/bin/hermes" kanban init || true
echo "Hermes dashboard local: http://127.0.0.1:${HERMES_KANBAN_PORT}/"
exec "$HERMES_DEV_VENV/bin/hermes" dashboard --host 0.0.0.0 --port "${HERMES_KANBAN_PORT}" --no-open --insecure
