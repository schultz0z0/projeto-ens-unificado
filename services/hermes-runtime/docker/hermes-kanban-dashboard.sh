#!/bin/bash
set -euo pipefail

# ============================================================
# hermes-kanban-dashboard.sh
# Runs the native Hermes Kanban dashboard against the same default profile data.
# ============================================================

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HERMES_DATA_PATH="${HERMES_DATA_PATH:-/opt/data}"
export HERMES_KANBAN_PORT="${HERMES_KANBAN_PORT:-9119}"

mkdir -p "$HERMES_DATA_PATH" \
         "$HERMES_DATA_PATH/kanban"

if [ -x /usr/local/bin/ensure-ens-rag-mcp.sh ]; then
  /usr/local/bin/ensure-ens-rag-mcp.sh || echo "[hermes-kanban] warning: could not ensure ENS RAG MCP config" >&2
fi

chown -R hermes:hermes "$HERMES_DATA_PATH" 2>/dev/null || true
chmod -R u+rwX,g+rwX "$HERMES_DATA_PATH" 2>/dev/null || true

run_as_hermes() {
  su -s /bin/bash hermes -c "$1"
}

run_as_hermes "export HERMES_HOME='${HERMES_HOME}' HERMES_DATA_PATH='${HERMES_DATA_PATH}'; source /opt/hermes/.venv/bin/activate && cd /opt/data && hermes kanban init || true"

echo "[hermes-kanban] Starting dashboard on 0.0.0.0:${HERMES_KANBAN_PORT}"

exec su -s /bin/bash hermes -c \
  "export HERMES_HOME='${HERMES_HOME}' HERMES_DATA_PATH='${HERMES_DATA_PATH}' HERMES_KANBAN_PORT='${HERMES_KANBAN_PORT}'; source /opt/hermes/.venv/bin/activate && cd /opt/data && hermes dashboard --host 0.0.0.0 --port ${HERMES_KANBAN_PORT} --no-open --insecure"
