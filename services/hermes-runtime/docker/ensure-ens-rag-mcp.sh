#!/bin/bash
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HERMES_DATA_PATH="${HERMES_DATA_PATH:-/opt/data}"

DEFAULT_CONFIG="${ENS_HERMES_DEFAULT_CONFIG:-/opt/hermes-defaults/config.yaml}"
PYTHON_BIN="${HERMES_PYTHON:-/opt/hermes/.venv/bin/python3}"

if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="$(command -v python3 || true)"
fi

if [ -z "$PYTHON_BIN" ]; then
  echo "[hermes-mcp] python3 unavailable; skipped MCP config repair" >&2
  exit 0
fi

mkdir -p "$HERMES_DATA_PATH"

if [ ! -f "$HERMES_DATA_PATH/config.yaml" ] && [ -f "$DEFAULT_CONFIG" ]; then
  cp "$DEFAULT_CONFIG" "$HERMES_DATA_PATH/config.yaml"
  echo "[hermes-mcp] created $HERMES_DATA_PATH/config.yaml from default template"
fi

"$PYTHON_BIN" /usr/local/bin/ensure-ens-rag-mcp.py "$HERMES_DATA_PATH"
