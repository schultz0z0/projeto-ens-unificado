#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/env/load-root-env.sh"
ROOT="${PROJETO_ENS_ROOT:-$ROOT}"

export HERMES_HOME="$ROOT/data/hermes"
export HERMES_DATA_PATH="$ROOT/data/hermes"
export API_SERVER_ENABLED="true"
export API_SERVER_HOST="${API_SERVER_HOST:-0.0.0.0}"
export API_SERVER_PORT="${NEXUS_HERMES_API_PORT:-8652}"
export API_SERVER_KEY="${NEXUS_HERMES_API_KEY:-change-me}"
export HERMES_API_KEY="${NEXUS_HERMES_API_KEY:-change-me}"
export HERMES_KANBAN_PORT="${NEXUS_HERMES_KANBAN_PORT:-9119}"
export GATEWAY_ALLOW_ALL_USERS="${NEXUS_HERMES_GATEWAY_ALLOW_ALL_USERS:-true}"

# Map central NEXUS_* vars to the names Hermes/provider SDKs expect.
export OPENROUTER_API_KEY="${NEXUS_OPENROUTER_API_KEY:-${OPENROUTER_API_KEY:-}}"
export OPENAI_API_KEY="${NEXUS_OPENAI_API_KEY:-${OPENAI_API_KEY:-}}"
export ANTHROPIC_API_KEY="${NEXUS_ANTHROPIC_API_KEY:-${ANTHROPIC_API_KEY:-}}"
export GEMINI_API_KEY="${NEXUS_GEMINI_API_KEY:-${GEMINI_API_KEY:-}}"
export GOOGLE_API_KEY="${NEXUS_GOOGLE_API_KEY:-${GOOGLE_API_KEY:-}}"

mkdir -p "$HERMES_HOME" "$HERMES_HOME/skills" "$HERMES_HOME/cron" "$HERMES_HOME/plugins" "$HERMES_HOME/logs" "$HERMES_HOME/sessions"
if [ ! -f "$HERMES_HOME/config.yaml" ]; then
  cp "$ROOT/services/hermes-runtime/templates/hermes/config.yaml" "$HERMES_HOME/config.yaml"
fi

export HERMES_DEV_VENV="$ROOT/services/hermes-runtime/.venv"
export PATH="$HERMES_DEV_VENV/bin:$ROOT/.tools:$PATH"
