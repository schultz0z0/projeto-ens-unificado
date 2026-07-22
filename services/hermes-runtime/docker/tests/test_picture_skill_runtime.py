from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml


RUNTIME_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = RUNTIME_ROOT / "docker" / "ensure-nexus-skills.sh"
SKILL = RUNTIME_ROOT / "skills" / "picture-hermes" / "SKILL.md"
START_JOB_TEMPLATE = RUNTIME_ROOT / "skills" / "picture-hermes" / "templates" / "picture-start-job.json"
DOCKERFILE = RUNTIME_ROOT / "docker" / "hermes.Dockerfile"


def test_picture_skill_contract_and_runtime_wiring():
    text = SKILL.read_text(encoding="utf-8")
    frontmatter = yaml.safe_load(text.split("---", 2)[1])
    assert frontmatter["name"] == "picture-hermes"
    for required in (
        "Hermes é o planner",
        "sessão marcada como Picture-Hermes",
        "Nunca use `image_generate`",
        "CreativeBrief",
        "CompositionPlan",
        "picture_get_workspace",
        "não aprove",
        "não resete",
        "não invente",
        "arrays JSON nativos",
        "nexusai-ens-design-system",
        "emoji",
        "PPTX",
        "imagem",
    ):
        assert required in text

    example = json.loads(START_JOB_TEMPLATE.read_text(encoding="utf-8"))
    pipeline = example["composition_plan"]["pipeline"]
    compose = next(step for step in pipeline if step["op"] == "compose")
    assert isinstance(pipeline, list)
    assert isinstance(compose["overlays"], list)
    assert example["creative_brief"]["brand_profile"] == "ENS"

    script = SCRIPT.read_text(encoding="utf-8")
    assert "HERMES_HOME" in script
    assert "picture-hermes" in script
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")
    assert "COPY skills /opt/nexus-skills" in dockerfile
    assert "ensure-nexus-skills.sh" in dockerfile


@pytest.mark.skipif(os.name == "nt" or shutil.which("bash") is None, reason="POSIX entrypoint contract")
def test_managed_skill_install_is_idempotent_and_preserves_user_skills(tmp_path):
    home = tmp_path / "home"
    source = tmp_path / "managed"
    (source / "picture-hermes").mkdir(parents=True)
    (source / "picture-hermes" / "SKILL.md").write_text("managed-v1\n", encoding="utf-8")
    (home / "skills" / "my-user-skill").mkdir(parents=True)
    (home / "skills" / "my-user-skill" / "SKILL.md").write_text("user\n", encoding="utf-8")
    env = {**os.environ, "HERMES_HOME": str(home), "NEXUS_MANAGED_SKILLS_DIR": str(source)}

    subprocess.run(["bash", str(SCRIPT)], env=env, check=True)
    first = (home / "skills" / "picture-hermes" / "SKILL.md").read_bytes()
    subprocess.run(["bash", str(SCRIPT)], env=env, check=True)
    second = (home / "skills" / "picture-hermes" / "SKILL.md").read_bytes()

    assert first == second == b"managed-v1\n"
    assert (home / "skills" / "my-user-skill" / "SKILL.md").read_text(encoding="utf-8") == "user\n"
