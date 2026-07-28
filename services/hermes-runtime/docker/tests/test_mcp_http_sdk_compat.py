from __future__ import annotations

import re
from pathlib import Path


MCP_TOOL = Path(__file__).resolve().parents[2] / "vendor" / "hermes-agent" / "tools" / "mcp_tool.py"


def test_current_streamable_http_client_enables_http_transport() -> None:
    text = MCP_TOOL.read_text()

    assert re.search(
        r"from mcp\.client\.streamable_http import streamable_http_client\n"
        r"\s+_MCP_NEW_HTTP = True\n"
        r"\s+_MCP_HTTP_AVAILABLE = True",
        text,
    )
