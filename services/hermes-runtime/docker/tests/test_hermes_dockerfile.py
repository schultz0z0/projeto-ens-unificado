from __future__ import annotations

from pathlib import Path


DOCKER_DIR = Path(__file__).resolve().parents[1]
DOCKERFILE = DOCKER_DIR / "hermes.Dockerfile"


def test_hermes_dockerfile_builds_dashboard_assets_from_source() -> None:
    text = DOCKERFILE.read_text()

    assert "HERMES_WEB_DIST=/opt/hermes-src/hermes_cli/web_dist" in text
    assert "npm ci --workspace web" in text
    assert "npm run build --workspace web" in text

