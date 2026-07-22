"""Keep Picture delegation credentials scoped to the current agent turn."""

from __future__ import annotations

import re
from typing import Any


_DELEGATION_BLOCK = re.compile(
    r"\[PICTURE_DELEGATION\][\s\S]*?"
    r"delegation_token:\s*(?P<token>\S+)[\s\S]*?"
    r"\[/PICTURE_DELEGATION\]"
)


def current_picture_delegation(ephemeral_system_prompt: str | None) -> str:
    if not isinstance(ephemeral_system_prompt, str):
        return ""
    match = _DELEGATION_BLOCK.search(ephemeral_system_prompt)
    return match.group("token") if match else ""


def bind_current_picture_delegation(
    function_name: str,
    function_args: dict[str, Any],
    ephemeral_system_prompt: str | None,
) -> dict[str, Any]:
    """Override copied, truncated, or redacted Picture tokens before dispatch."""
    normalized_name = str(function_name or "").lower()
    if "nexus_picture" not in normalized_name and "picture_" not in normalized_name:
        return function_args
    token = current_picture_delegation(ephemeral_system_prompt)
    if not token:
        return function_args
    return {**function_args, "delegation_token": token}
