from __future__ import annotations

from pathlib import Path


DOCKER_DIR = Path(__file__).resolve().parents[1]
DOCKERFILE = DOCKER_DIR / "hermes.Dockerfile"
API_SERVER = DOCKER_DIR / "hermes-api-server.sh"


def test_hermes_dockerfile_builds_dashboard_assets_from_source() -> None:
    text = DOCKERFILE.read_text()

    assert "HERMES_WEB_DIST=/opt/hermes-src/hermes_cli/web_dist" in text
    assert "npm ci --workspace web" in text
    assert "npm run build --workspace web" in text


def test_hermes_runtime_scrubs_persisted_marketing_ops_delegations() -> None:
    dockerfile = DOCKERFILE.read_text()
    api_server = API_SERVER.read_text()

    assert "COPY docker/scrub-marketing-ops-delegations.py" in dockerfile
    assert "/usr/local/bin/scrub-marketing-ops-delegations.py" in api_server


def test_pptx_dependencies_use_system_chromium_and_fail_closed() -> None:
    text = DOCKERFILE.read_text()

    assert "PUPPETEER_SKIP_DOWNLOAD=true" in text
    assert "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium" in text
    assert "npm ci --omit=dev --no-audit --no-fund &&" in text
    assert "npm ci --omit=dev --no-audit --no-fund 2>&1 | tail" not in text

