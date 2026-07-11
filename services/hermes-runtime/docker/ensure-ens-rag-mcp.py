#!/usr/bin/env python3
"""Ensure Nexus-managed MCP servers are present in Hermes configs."""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import yaml
except Exception as exc:  # pragma: no cover - depends on container runtime
    print(f"[hermes-mcp] PyYAML unavailable; skipped MCP config repair: {exc}", file=sys.stderr)
    raise SystemExit(0)


def managed_mcp_servers() -> dict[str, dict]:
    return {
        "nexus_rag": {
            "url": os.environ.get("ENS_RAG_MCP_URL", "http://rag-mcp:8000/mcp"),
            "timeout": int(os.environ.get("ENS_RAG_MCP_TIMEOUT", "180")),
            "connect_timeout": int(os.environ.get("ENS_RAG_MCP_CONNECT_TIMEOUT", "30")),
            "sampling": {"enabled": False},
        },
        "nexus_graph": {
            "url": os.environ.get("NEXUS_GRAPH_MCP_URL", "http://graph-mcp:8010/mcp"),
            "timeout": int(os.environ.get("NEXUS_GRAPH_MCP_TIMEOUT", "180")),
            "connect_timeout": int(os.environ.get("NEXUS_GRAPH_MCP_CONNECT_TIMEOUT", "30")),
            "sampling": {"enabled": False},
        },
        "nexus_marketing_ops": {
            "url": os.environ.get("NEXUS_MARKETING_OPS_MCP_URL", "http://marketing-ops:8091/mcp"),
            "timeout": int(os.environ.get("NEXUS_MARKETING_OPS_MCP_TIMEOUT", "120")),
            "connect_timeout": int(os.environ.get("NEXUS_MARKETING_OPS_MCP_CONNECT_TIMEOUT", "15")),
            "sampling": {"enabled": False},
        },
    }


def load_config(path: Path) -> dict:
    if not path.exists():
        return {}

    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return {}

    config = yaml.safe_load(raw)
    if config is None:
        return {}
    if not isinstance(config, dict):
        raise ValueError(f"{path} is not a YAML mapping")
    return config


def ensure_servers(path: Path) -> bool:
    config = load_config(path)
    servers = config.setdefault("mcp_servers", {})

    if not isinstance(servers, dict):
        raise ValueError(f"{path} has a non-mapping mcp_servers value")

    changed = False
    for server_name, server_config in managed_mcp_servers().items():
        if servers.get(server_name) == server_config:
            continue
        servers[server_name] = server_config
        changed = True

    if not changed:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(config, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return True


def candidate_configs(data_path: Path) -> list[Path]:
    configs = [data_path / "config.yaml"]

    profiles_path = data_path / "profiles"
    if profiles_path.is_dir():
        configs.extend(sorted(profiles_path.glob("*/config.yaml")))

    active_profile_file = data_path / "active_profile"
    if active_profile_file.exists():
        active_name = active_profile_file.read_text(encoding="utf-8").strip()
        if active_name:
            active_config = profiles_path / active_name / "config.yaml"
            if active_config.parent.exists():
                configs.append(active_config)

    seen: set[Path] = set()
    unique_configs: list[Path] = []
    for config in configs:
        resolved = config.resolve(strict=False)
        if resolved not in seen:
            unique_configs.append(config)
            seen.add(resolved)
    return unique_configs


def main() -> int:
    data_path = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("HERMES_DATA_PATH", "/opt/data"))
    changed = 0

    for config_path in candidate_configs(data_path):
        try:
            if ensure_servers(config_path):
                changed += 1
                print(f"[hermes-mcp] ensured Nexus MCP servers in {config_path}")
        except Exception as exc:
            print(f"[hermes-mcp] could not update {config_path}: {exc}", file=sys.stderr)

    if changed == 0:
        print("[hermes-mcp] Nexus MCP servers already configured")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
