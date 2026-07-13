"""Keep Marketing Ops delegation credentials scoped to the current agent turn."""

from __future__ import annotations

import base64
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
_PREPARE_PLAN_TOOL = "marketing_ops_prepare_plan_v1"
_EXECUTE_PLAN_TOOL = "marketing_ops_execute_plan_v1"

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


def _plan_token_from_tool_result(content: Any) -> str:
    value = content
    if isinstance(value, str) and value.lstrip().startswith("<untrusted_tool_result"):
        start = value.find("\n\n")
        end = value.rfind("\n</untrusted_tool_result>")
        if start >= 0 and end > start:
            value = value[start + 2:end]

    for _ in range(4):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return ""
            continue
        if not isinstance(value, dict):
            return ""
        token = value.get("plan_token")
        if isinstance(token, str) and len(token) >= 20:
            return token
        if "result" not in value:
            return ""
        value = value["result"]
    return ""


def bind_latest_marketing_ops_plan_token(
    function_name: str,
    function_args: dict[str, Any],
    messages: list[Any],
) -> dict[str, Any]:
    """Use the latest successfully prepared plan instead of model-copied JWTs."""
    normalized_name = str(function_name or "").lower()
    if not normalized_name.endswith(_EXECUTE_PLAN_TOOL):
        return function_args

    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        tool_name = str(message.get("name") or message.get("tool_name") or "").lower()
        if not tool_name.endswith(_PREPARE_PLAN_TOOL):
            continue
        token = _plan_token_from_tool_result(message.get("content"))
        return {**function_args, "plan_token": token} if token else function_args
    return function_args


def marketing_ops_plan_execution_block_message(
    function_name: str,
    function_args: dict[str, Any],
) -> str | None:
    """Fail closed before execute_plan when the current turn is not a confirmation."""
    normalized_name = str(function_name or "").lower()
    if not normalized_name.endswith(_EXECUTE_PLAN_TOOL):
        return None

    token = function_args.get("delegation_token")
    try:
        payload_segment = str(token).split(".")[1]
        padding = "=" * (-len(payload_segment) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_segment + padding))
        if payload.get("confirmation_intent") is True:
            return None
    except (IndexError, ValueError, TypeError, json.JSONDecodeError):
        pass

    return (
        "confirmation_required: execution is allowed only in a later turn "
        "that explicitly confirms the latest prepared plan. Do not retry "
        "execute_plan in this turn; present the plan and ask for confirmation."
    )


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
