#!/bin/bash
set -euo pipefail

# ============================================================
# hermes-init.sh
# Minimal compatibility entrypoint.
# The compose services now call hermes-api-server.sh or
# hermes-kanban-dashboard.sh directly. This file is kept for manual runs.
# ============================================================

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HERMES_DATA_PATH="${HERMES_DATA_PATH:-/opt/data}"
mkdir -p "$HERMES_DATA_PATH"
chown -R hermes:hermes "$HERMES_DATA_PATH" 2>/dev/null || true

exec "$@"
