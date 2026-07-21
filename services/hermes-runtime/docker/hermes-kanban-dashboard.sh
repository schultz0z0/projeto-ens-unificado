#!/bin/bash
set -euo pipefail

# ============================================================
# hermes-kanban-dashboard.sh
# Runs the native Hermes Kanban dashboard against the same default profile data.
# ============================================================

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HERMES_DATA_PATH="${HERMES_DATA_PATH:-/opt/data}"
export HERMES_KANBAN_PORT="${HERMES_KANBAN_PORT:-9119}"
export HERMES_ARTIFACTS_DIR="${HERMES_ARTIFACTS_DIR:-/opt/data/nexus-artifacts}"
export HERMES_ARTIFACT_MAX_BYTES="${HERMES_ARTIFACT_MAX_BYTES:-5368709120}"
export HERMES_IMAGE_SUPABASE_DELETE_LOCAL_CACHE="${HERMES_IMAGE_SUPABASE_DELETE_LOCAL_CACHE:-true}"
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"
export SUPABASE_URL="${SUPABASE_URL:-}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
export SUPABASE_OUTPUTS_BUCKET="${SUPABASE_OUTPUTS_BUCKET:-image-gen-outputs}"
export SUPABASE_GENERATED_IMAGES_PREFIX="${SUPABASE_GENERATED_IMAGES_PREFIX:-hermes-chat-images}"
export SUPABASE_SIGNED_URL_EXPIRES_SECONDS="${SUPABASE_SIGNED_URL_EXPIRES_SECONDS:-604800}"
export SUPABASE_UPLOAD_MAX_ATTEMPTS="${SUPABASE_UPLOAD_MAX_ATTEMPTS:-3}"
export SUPABASE_UPLOAD_BACKOFF_SECONDS="${SUPABASE_UPLOAD_BACKOFF_SECONDS:-2}"
export NEXUS_GRAPH_BACKEND="${NEXUS_GRAPH_BACKEND:-neo4j-multi-tenant-user}"
export NEXUS_GRAPH_MCP_URL="${NEXUS_GRAPH_MCP_URL:-http://graph-mcp:8010/mcp}"
export NEXUS_MARKETING_OPS_MCP_URL="${NEXUS_MARKETING_OPS_MCP_URL:-http://marketing-ops:8091/mcp}"
export NEXUS_PICTURE_MCP_URL="${NEXUS_PICTURE_MCP_URL:-http://picture-it:8090/mcp}"
export NEXUS_TENANT_ID="${NEXUS_TENANT_ID:-public}"
export NEXUS_GRAPH_URL="${NEXUS_GRAPH_URL:-bolt://neo4j:7687}"
export NEXUS_NEO4J_USER="${NEXUS_NEO4J_USER:-neo4j}"
export NEXUS_NEO4J_PASSWORD="${NEXUS_NEO4J_PASSWORD:-nexus-neo4j}"

build_hermes_exports() {
  local name value
  printf 'export'
  for name in "$@"; do
    value="${!name:-}"
    printf ' %s=%q' "$name" "$value"
  done
}

mkdir -p "$HERMES_DATA_PATH" \
         "$HERMES_DATA_PATH/kanban"

if [ -x /usr/local/bin/ensure-ens-rag-mcp.sh ]; then
  /usr/local/bin/ensure-ens-rag-mcp.sh || echo "[hermes-kanban] warning: could not ensure Nexus MCP config" >&2
fi

if [ -x /usr/local/bin/ensure-nexus-skills.sh ]; then
  /usr/local/bin/ensure-nexus-skills.sh || echo "[hermes-kanban] warning: could not ensure Nexus skills" >&2
fi

chown -R hermes:hermes "$HERMES_DATA_PATH" 2>/dev/null || true
chmod -R u+rwX,g+rwX "$HERMES_DATA_PATH" 2>/dev/null || true

run_as_hermes() {
  su -s /bin/bash hermes -c "${HERMES_ENV_EXPORTS}; $1"
}

HERMES_ENV_EXPORTS="$(build_hermes_exports \
  HERMES_HOME HERMES_DATA_PATH HERMES_KANBAN_PORT HERMES_ARTIFACTS_DIR HERMES_ARTIFACT_MAX_BYTES HERMES_IMAGE_SUPABASE_DELETE_LOCAL_CACHE \
  OPENROUTER_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY GOOGLE_API_KEY \
  SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_OUTPUTS_BUCKET SUPABASE_GENERATED_IMAGES_PREFIX \
  SUPABASE_SIGNED_URL_EXPIRES_SECONDS SUPABASE_UPLOAD_MAX_ATTEMPTS SUPABASE_UPLOAD_BACKOFF_SECONDS \
  NEXUS_GRAPH_BACKEND NEXUS_GRAPH_MCP_URL NEXUS_MARKETING_OPS_MCP_URL NEXUS_PICTURE_MCP_URL NEXUS_TENANT_ID NEXUS_GRAPH_URL NEXUS_NEO4J_USER NEXUS_NEO4J_PASSWORD)"

run_as_hermes "source /opt/hermes/.venv/bin/activate && cd /opt/data && hermes kanban init || true"

echo "[hermes-kanban] Starting dashboard on 0.0.0.0:${HERMES_KANBAN_PORT}"

exec su -s /bin/bash hermes -c \
  "${HERMES_ENV_EXPORTS}; source /opt/hermes/.venv/bin/activate && cd /opt/data && hermes dashboard --host 0.0.0.0 --port ${HERMES_KANBAN_PORT} --no-open --insecure"
