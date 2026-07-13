"""Keep Marketing Ops delegation credentials scoped to the current agent turn."""

from __future__ import annotations

import json
import re
from typing import Any


REDACTED_DELEGATION = "[REDACTED_EPHEMERAL_DELEGATION]"
_DIRECT_MUTATION_TOOLS = frozenset(
    {
        "marketing_ops_create_campaign_draft_v1",
        "marketing_ops_update_campaign_draft_v1",
        "marketing_ops_create_campaign_item_draft_v1",
    }
)

_DELEGATION_BLOCK = re.compile(
    r"\[MARKETING_OPS_DELEGATION\][\s\S]*?"
    r"delegation_token:\s*(?P<token>\S+)[\s\S]*?"
    r"\[/MARKETING_OPS_DELEGATION\]"
)
_DELEGATION_JSON_FIELD = re.compile(
    r'(?P<prefix>"delegation_token"\s*:\s*)"(?:\\.|[^"\\])*"',
    re.IGNORECASE,
)


def current_marketing_ops_delegation(ephemeral_system_prompt: str | None) -> str:
    if not isinstance(ephemeral_system_prompt, str):
        return ""
    match = _DELEGATION_BLOCK.search(ephemeral_system_prompt)
    return match.group("token") if match else ""


def bind_current_marketing_ops_delegation(
    function_name: str,
    function_args: dict[str, Any],
    ephemeral_system_prompt: str | None,
) -> dict[str, Any]:
    """Override model-selected credentials immediately before tool execution."""
    normalized_name = str(function_name or "").lower()
    if "marketing_ops_" not in normalized_name:
        return function_args
    if "marketing_ops_capabilities_v1" in normalized_name:
        return function_args

    token = current_marketing_ops_delegation(ephemeral_system_prompt)
    if not token:
        return function_args

    return {**function_args, "delegation_token": token}


def marketing_ops_direct_mutation_block_message(function_name: str) -> str | None:
    """Force Hermes mutations through the signed plan/confirmation contract."""
    normalized_name = str(function_name or "").lower()
    if any(normalized_name.endswith(tool_name) for tool_name in _DIRECT_MUTATION_TOOLS):
        return (
            "confirmation_plan_required: direct Marketing Ops mutations are blocked. "
            "Use marketing_ops_prepare_plan_v1, present the complete plan to the user, "
            "then use marketing_ops_execute_plan_v1 only after explicit confirmation."
        )
    return None


def redact_marketing_ops_delegations(value: Any) -> Any:
    """Return a copy with every nested delegation_token value removed."""
    if isinstance(value, dict):
        return {
            key: (
                REDACTED_DELEGATION
                if str(key).lower() == "delegation_token"
                else redact_marketing_ops_delegations(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_marketing_ops_delegations(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_marketing_ops_delegations(item) for item in value)
    if not isinstance(value, str) or "delegation_token" not in value.lower():
        return value

    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return _DELEGATION_JSON_FIELD.sub(
            lambda match: f'{match.group("prefix")}"{REDACTED_DELEGATION}"',
            value,
        )

    if not isinstance(parsed, (dict, list)):
        return value
    redacted = redact_marketing_ops_delegations(parsed)
    return json.dumps(redacted, ensure_ascii=False, separators=(",", ":"))
