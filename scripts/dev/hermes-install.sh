#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS_DIR="$ROOT/.tools"
UV="$TOOLS_DIR/uv"
HERMES_SRC="$ROOT/services/hermes-runtime/vendor/hermes-agent"
VENV_DIR="$ROOT/services/hermes-runtime/.venv"
PY_VERSION="${HERMES_DEV_PYTHON_VERSION:-3.13}"

if [ ! -d "$HERMES_SRC" ] || [ ! -f "$HERMES_SRC/pyproject.toml" ]; then
  echo "ERRO: Hermes source não encontrado em $HERMES_SRC" >&2
  exit 1
fi

if [ ! -x "$UV" ]; then
  mkdir -p "$TOOLS_DIR"
  echo "Instalando uv local em $TOOLS_DIR ..."
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="$TOOLS_DIR" sh
fi

"$UV" --version
"$UV" python install "$PY_VERSION"
if [ ! -x "$VENV_DIR/bin/python" ]; then
  "$UV" venv --python "$PY_VERSION" "$VENV_DIR"
else
  echo "Reutilizando venv existente: $VENV_DIR"
fi
PY="$VENV_DIR/bin/python"

"$UV" pip install --python "$PY" --upgrade pip setuptools wheel
"$UV" pip install --python "$PY" --upgrade \
  -e "$HERMES_SRC[web,pty]" \
  "mcp" \
  "playwright" \
  "uv"

if [ "${SKIP_PLAYWRIGHT_BROWSER_INSTALL:-0}" != "1" ]; then
  if ! "$PY" -m playwright install chromium; then
    echo "AVISO: Playwright Chromium não pôde ser instalado neste WSL."
    echo "O Hermes core/API continua instalado; browser automation local pode exigir Chromium do sistema ou validação via Docker/VPS."
  fi
fi

"$PY" - <<'PY'
import importlib.util, sys
print('python=', sys.executable)
for mod in ['hermes_cli', 'agent', 'tools', 'mcp', 'playwright']:
    print(f'{mod}:', 'OK' if importlib.util.find_spec(mod) else 'MISSING')
PY

"$VENV_DIR/bin/hermes" --version

echo
echo "Hermes dev venv pronto: $VENV_DIR"
echo "Source editável: $HERMES_SRC"
echo "Rodar API local: bash scripts/dev/hermes-api-local.sh"
echo "Rodar Dashboard local: bash scripts/dev/hermes-dashboard-local.sh"
