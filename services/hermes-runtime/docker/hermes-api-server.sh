#!/bin/bash
set -euo pipefail

# ============================================================
# hermes-api-server.sh
# Runs only the default Hermes profile as an OpenAI-compatible API server.
# Portable state/config lives in /opt/data (mounted from ./data/hermes).
# ============================================================

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HERMES_DATA_PATH="${HERMES_DATA_PATH:-/opt/data}"
export API_SERVER_ENABLED="${API_SERVER_ENABLED:-true}"
export API_SERVER_HOST="${API_SERVER_HOST:-0.0.0.0}"
export API_SERVER_PORT="${API_SERVER_PORT:-${HERMES_API_PORT:-8652}}"
export API_SERVER_KEY="${API_SERVER_KEY:-${HERMES_API_KEY:-change-me}}"
export GATEWAY_ALLOW_ALL_USERS="${GATEWAY_ALLOW_ALL_USERS:-true}"
export HERMES_ARTIFACTS_DIR="${HERMES_ARTIFACTS_DIR:-/opt/data/nexus-artifacts}"
export HERMES_ARTIFACT_MAX_BYTES="${HERMES_ARTIFACT_MAX_BYTES:-5368709120}"

mkdir -p "$HERMES_DATA_PATH" \
         "$HERMES_DATA_PATH/skills" \
         "$HERMES_DATA_PATH/cron" \
         "$HERMES_DATA_PATH/plugins" \
         "$HERMES_ARTIFACTS_DIR"

if [ -x /usr/local/bin/ensure-ens-rag-mcp.sh ]; then
  /usr/local/bin/ensure-ens-rag-mcp.sh || echo "[hermes-api] warning: could not ensure ENS RAG MCP config" >&2
fi

chown -R hermes:hermes "$HERMES_DATA_PATH" "$HERMES_ARTIFACTS_DIR" 2>/dev/null || true
chmod -R u+rwX,g+rwX "$HERMES_DATA_PATH" "$HERMES_ARTIFACTS_DIR" 2>/dev/null || true
chmod -R u+rwX,g+rwX,o+rX "$HERMES_ARTIFACTS_DIR" 2>/dev/null || true
umask 0022

run_as_hermes() {
  su -s /bin/bash hermes -c "$1"
}

echo "[hermes-api] Starting default Hermes profile API on ${API_SERVER_HOST}:${API_SERVER_PORT}"
echo "[hermes-api] HERMES_HOME=${HERMES_HOME}"

exec su -s /bin/bash hermes -c \
  "export HERMES_HOME='${HERMES_HOME}' HERMES_DATA_PATH='${HERMES_DATA_PATH}' API_SERVER_ENABLED='${API_SERVER_ENABLED}' API_SERVER_HOST='${API_SERVER_HOST}' API_SERVER_PORT='${API_SERVER_PORT}' API_SERVER_KEY='${API_SERVER_KEY}' GATEWAY_ALLOW_ALL_USERS='${GATEWAY_ALLOW_ALL_USERS}' HERMES_ARTIFACTS_DIR='${HERMES_ARTIFACTS_DIR}' HERMES_ARTIFACT_MAX_BYTES='${HERMES_ARTIFACT_MAX_BYTES}'; source /opt/hermes/.venv/bin/activate && cd /opt/data && hermes gateway run"
