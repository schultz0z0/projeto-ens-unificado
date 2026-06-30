from __future__ import annotations

import importlib.util
from pathlib import Path

import yaml


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "ensure-ens-rag-mcp.py"


def load_script():
    spec = importlib.util.spec_from_file_location("ensure_ens_rag_mcp", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_ensure_server_registers_rag_and_graph_mcp(tmp_path, monkeypatch):
    monkeypatch.setenv("ENS_RAG_MCP_URL", "http://rag-mcp:8000/mcp")
    monkeypatch.setenv("NEXUS_GRAPH_MCP_URL", "http://graph-mcp:8010/mcp")
    module = load_script()

    config_path = tmp_path / "config.yaml"
    changed = module.ensure_servers(config_path)

    assert changed is True
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    assert config["mcp_servers"]["nexus_rag"]["url"] == "http://rag-mcp:8000/mcp"
    assert config["mcp_servers"]["nexus_graph"]["url"] == "http://graph-mcp:8010/mcp"
    assert config["mcp_servers"]["nexus_graph"]["sampling"]["enabled"] is False


def test_ensure_server_updates_existing_profile_without_losing_custom_mcp(tmp_path, monkeypatch):
    monkeypatch.setenv("NEXUS_GRAPH_MCP_URL", "http://graph-mcp:8010/mcp")
    module = load_script()

    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        yaml.safe_dump(
            {
                "mcp_servers": {
                    "custom": {"url": "http://custom.local/mcp"},
                    "nexus_rag": {"url": "http://old-rag/mcp"},
                }
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )

    changed = module.ensure_servers(config_path)
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))

    assert changed is True
    assert config["mcp_servers"]["custom"]["url"] == "http://custom.local/mcp"
    assert config["mcp_servers"]["nexus_rag"]["url"] == "http://rag-mcp:8000/mcp"
    assert config["mcp_servers"]["nexus_graph"]["url"] == "http://graph-mcp:8010/mcp"
