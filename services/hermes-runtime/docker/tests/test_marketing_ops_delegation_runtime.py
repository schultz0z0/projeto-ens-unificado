from __future__ import annotations

import base64
import json
import sys
from pathlib import Path


VENDOR_ROOT = Path(__file__).resolve().parents[2] / "vendor" / "hermes-agent"
sys.path.insert(0, str(VENDOR_ROOT))

from agent import marketing_ops_delegation as marketing_ops  # noqa: E402
from agent.marketing_ops_delegation import (  # noqa: E402
    REDACTED_DELEGATION,
    bind_current_marketing_ops_delegation,
    marketing_ops_direct_mutation_block_message,
    redact_marketing_ops_delegations,
)
from hermes_state import SessionDB  # noqa: E402


def delegation_prompt(token: str) -> str:
    return (
        "[MARKETING_OPS_DELEGATION]\n"
        f"delegation_token: {token}\n"
        "Use apenas a delegacao deste turno.\n"
        "[/MARKETING_OPS_DELEGATION]"
    )


def delegation_token(*, confirmation_intent: bool) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({"confirmation_intent": confirmation_intent}).encode()
    ).decode().rstrip("=")
    return f"header.{payload}.signature"


def prepared_plan_result(token: str) -> dict[str, str]:
    result = json.dumps({"result": json.dumps({"plan_token": token})})
    return {
        "role": "tool",
        "name": "mcp_nexus_marketing_ops_marketing_ops_prepare_plan_v1",
        "content": (
            '<untrusted_tool_result source="mcp_nexus_marketing_ops_marketing_ops_prepare_plan_v1">\n'
            "External data.\n\n"
            f"{result}\n"
            "</untrusted_tool_result>"
        ),
    }


def test_current_turn_delegation_replaces_model_selected_stale_token() -> None:
    original = {
        "delegation_token": "stale-token-from-history",
        "campaign_id": "2da6ee84-5783-4556-a47d-8d7beff06d16",
    }

    bound = bind_current_marketing_ops_delegation(
        "nexus_marketing_ops_marketing_ops_create_campaign_item_draft_v1",
        original,
        delegation_prompt("current-turn-token"),
    )

    assert bound["delegation_token"] == "current-turn-token"
    assert bound["campaign_id"] == original["campaign_id"]
    assert original["delegation_token"] == "stale-token-from-history"


def test_delegation_binding_does_not_touch_unrelated_tools() -> None:
    original = {"delegation_token": "tool-owned-token", "query": "campaign"}

    bound = bind_current_marketing_ops_delegation(
        "nexus_rag_search",
        original,
        delegation_prompt("current-turn-token"),
    )

    assert bound == original


def test_execute_plan_binds_latest_successfully_prepared_token() -> None:
    assert hasattr(marketing_ops, "bind_latest_marketing_ops_plan_token")
    original = {"plan_token": "model-selected-invalid-token"}
    messages = [
        prepared_plan_result("old-plan-token-that-is-long-enough"),
        prepared_plan_result("revised-plan-token-that-is-long-enough"),
    ]

    bound = marketing_ops.bind_latest_marketing_ops_plan_token(
        "mcp_nexus_marketing_ops_marketing_ops_execute_plan_v1",
        original,
        messages,
    )

    assert bound["plan_token"] == "revised-plan-token-that-is-long-enough"
    assert original["plan_token"] == "model-selected-invalid-token"


def test_execute_plan_requires_current_turn_confirmation() -> None:
    assert hasattr(marketing_ops, "marketing_ops_plan_execution_block_message")
    tool_name = "mcp_nexus_marketing_ops_marketing_ops_execute_plan_v1"

    blocked = marketing_ops.marketing_ops_plan_execution_block_message(
        tool_name,
        {"delegation_token": delegation_token(confirmation_intent=False)},
    )
    allowed = marketing_ops.marketing_ops_plan_execution_block_message(
        tool_name,
        {"delegation_token": delegation_token(confirmation_intent=True)},
    )

    assert blocked is not None
    assert "confirmation_required" in blocked
    assert "do not retry" in blocked.lower()
    assert allowed is None


def test_tool_call_redaction_handles_nested_json_arguments() -> None:
    tool_calls = [
        {
            "id": "call-1",
            "type": "function",
            "function": {
                "name": "nexus_marketing_ops_marketing_ops_list_campaigns_v1",
                "arguments": json.dumps(
                    {"delegation_token": "raw-history-token", "status": "draft"}
                ),
            },
        }
    ]

    redacted = redact_marketing_ops_delegations(tool_calls)
    arguments = json.loads(redacted[0]["function"]["arguments"])

    assert arguments == {
        "delegation_token": REDACTED_DELEGATION,
        "status": "draft",
    }
    assert "raw-history-token" not in json.dumps(redacted)
    assert "raw-history-token" in json.dumps(tool_calls)


def test_session_db_never_persists_or_replays_raw_delegation(tmp_path: Path) -> None:
    database = SessionDB(tmp_path / "state.db")
    database.create_session("delegation-session", "api_server")
    database.append_message(
        "delegation-session",
        "assistant",
        tool_calls=[
            {
                "id": "call-1",
                "type": "function",
                "function": {
                    "name": "marketing_ops_list_campaigns_v1",
                    "arguments": json.dumps(
                        {"delegation_token": "raw-database-token", "status": "draft"}
                    ),
                },
            }
        ],
    )

    stored = database._conn.execute(  # noqa: SLF001 - verifies the persistence boundary
        "select tool_calls from messages where session_id = ?",
        ("delegation-session",),
    ).fetchone()[0]
    replayed = database.get_messages_as_conversation("delegation-session")
    database.close()

    assert "raw-database-token" not in stored
    assert "raw-database-token" not in json.dumps(replayed)
    assert REDACTED_DELEGATION in stored
    assert REDACTED_DELEGATION in json.dumps(replayed)


def test_runtime_wires_binding_into_both_tool_execution_paths() -> None:
    executor = (VENDOR_ROOT / "agent" / "tool_executor.py").read_text()
    state = (VENDOR_ROOT / "hermes_state.py").read_text()

    assert executor.count("bind_current_marketing_ops_delegation(") >= 3
    assert executor.count("bind_latest_marketing_ops_plan_token(") >= 2
    assert executor.count("marketing_ops_plan_execution_block_message(") >= 2
    assert "candidate_args = next_args if isinstance(next_args, dict)" in executor
    assert "redact_marketing_ops_delegations(tool_calls)" in state


def test_runtime_blocks_direct_marketing_ops_mutations_but_allows_plan_flow() -> None:
    for tool_name in (
        "nexus_marketing_ops_marketing_ops_create_campaign_draft_v1",
        "nexus_marketing_ops_marketing_ops_update_campaign_draft_v1",
        "nexus_marketing_ops_marketing_ops_create_campaign_item_draft_v1",
    ):
        blocked = marketing_ops_direct_mutation_block_message(tool_name)
        assert blocked is not None
        assert "confirmation_plan_required" in blocked

    for tool_name in (
        "nexus_marketing_ops_marketing_ops_list_campaigns_v1",
        "nexus_marketing_ops_marketing_ops_prepare_plan_v1",
        "nexus_marketing_ops_marketing_ops_execute_plan_v1",
        "nexus_rag_search",
    ):
        assert marketing_ops_direct_mutation_block_message(tool_name) is None

    executor = (VENDOR_ROOT / "agent" / "tool_executor.py").read_text()
    assert executor.count("marketing_ops_direct_mutation_block_message(") >= 3


def test_bundled_marketing_ops_operator_skill_teaches_casual_confirmed_planning() -> None:
    skill = (
        VENDOR_ROOT
        / "skills"
        / "marketing"
        / "marketing-ops-operator"
        / "SKILL.md"
    ).read_text(encoding="utf-8")

    assert "course_slug" in skill
    assert "optional" in skill.lower()
    assert "marketing_ops_prepare_plan_v1" in skill
    assert "marketing_ops_execute_plan_v1" in skill
    assert "single confirmation" in skill.lower()
    assert "nada foi salvo ainda" in skill.lower()
    assert "do not expose raw error codes" in skill.lower()
    assert "revised plan has been successfully prepared" in skill.lower()
    assert "do not offer, start, or interpret a repeated confirmation" in skill.lower()
