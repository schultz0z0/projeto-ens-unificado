from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


RUNTIME_ROOT = Path(__file__).resolve().parents[2]
VENDOR_ROOT = RUNTIME_ROOT / "vendor" / "hermes-agent"
sys.path.insert(0, str(VENDOR_ROOT))

from agent import marketing_ops_delegation as marketing_ops  # noqa: E402
from agent.marketing_ops_delegation import (  # noqa: E402
    REDACTED_DELEGATION,
    bind_current_marketing_ops_delegation,
    has_pending_marketing_ops_plan,
    marketing_ops_direct_mutation_block_message,
    parse_marketing_ops_confirmation_decision,
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


def test_model_visible_marketing_ops_schema_hides_runtime_bound_credentials() -> None:
    from tools.mcp_tool import _convert_mcp_schema

    prepare_tool = SimpleNamespace(
        name="marketing_ops_prepare_plan_v1",
        description="Prepare a signed plan",
        inputSchema={
            "type": "object",
            "properties": {
                "delegation_token": {"type": "string"},
                "actions": {
                    "type": "array",
                    "items": {"type": "object", "properties": {}},
                },
            },
            "required": ["delegation_token", "actions"],
        },
    )
    execute_tool = SimpleNamespace(
        name="marketing_ops_execute_plan_v1",
        description="Execute the latest confirmed plan",
        inputSchema={
            "type": "object",
            "properties": {
                "delegation_token": {"type": "string"},
                "plan_token": {"type": "string"},
            },
            "required": ["delegation_token", "plan_token"],
        },
    )

    prepare_schema = _convert_mcp_schema("nexus_marketing_ops", prepare_tool)
    execute_schema = _convert_mcp_schema("nexus_marketing_ops", execute_tool)

    assert prepare_schema["parameters"]["properties"] == {
        "actions": {
            "type": "array",
            "items": {"type": "object", "properties": {}},
        }
    }
    assert prepare_schema["parameters"]["required"] == ["actions"]
    assert execute_schema["parameters"] == {
        "type": "object",
        "properties": {},
    }


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


def test_contextual_confirmation_decision_is_closed_and_requires_a_pending_plan() -> None:
    assert parse_marketing_ops_confirmation_decision('{"decision":"approve"}') == "approve"
    assert (
        parse_marketing_ops_confirmation_decision(
            'NEXUS_MARKETING_OPS_DECISION: {"decision":"approve"}'
        )
        == "approve"
    )
    assert parse_marketing_ops_confirmation_decision('{"decision":"reject"}') == "reject"
    assert parse_marketing_ops_confirmation_decision('{"decision":"revise"}') == "revise"
    assert parse_marketing_ops_confirmation_decision('{"decision":"clarify"}') == "clarify"
    assert parse_marketing_ops_confirmation_decision('{"decision":"none"}') == "none"
    assert parse_marketing_ops_confirmation_decision('approve') == "clarify"
    assert parse_marketing_ops_confirmation_decision('{"decision":"execute"}') == "clarify"
    assert (
        parse_marketing_ops_confirmation_decision(
            'NEXUS_MARKETING_OPS_DECISION: {"decision":"approve"}\nextra'
        )
        == "clarify"
    )
    assert parse_marketing_ops_confirmation_decision('text {"decision":"approve"}') == "clarify"

    prepared = prepared_plan_result("pending-plan-token-that-is-long-enough")
    executed = {
        "role": "tool",
        "name": "mcp_nexus_marketing_ops_marketing_ops_execute_plan_v1",
        "content": '{"status":"completed"}',
    }
    assert has_pending_marketing_ops_plan([prepared]) is True
    assert has_pending_marketing_ops_plan([prepared, executed]) is False


def test_unambiguous_confirmation_fast_path_accepts_only_complete_short_replies() -> None:
    assert hasattr(marketing_ops, "unambiguous_marketing_ops_confirmation_decision")
    for reply in (
        "vamos nessa",
        "Vamos nessa!",
        "pode ser",
        "SIM.",
        "confirmo",
        "pode executar",
        "perfeito!",
    ):
        assert marketing_ops.unambiguous_marketing_ops_confirmation_decision(reply) == "approve"

    for reply in ("não", "Nao.", "rejeito", "não execute"):
        assert marketing_ops.unambiguous_marketing_ops_confirmation_decision(reply) == "reject"

    for reply in (
        "vamos nessa, mas sem Instagram",
        "pode ser amanhã?",
        "sim, altere a data",
        "não sei",
        "o orçamento está correto?",
    ):
        assert marketing_ops.unambiguous_marketing_ops_confirmation_decision(reply) is None


def test_confirmation_output_contract_reports_every_accepted_closed_json_shape() -> None:
    assert hasattr(marketing_ops, "has_marketing_ops_confirmation_decision_contract")
    assert marketing_ops.has_marketing_ops_confirmation_decision_contract(
        'NEXUS_MARKETING_OPS_DECISION: {"decision":"approve"}'
    )
    assert marketing_ops.has_marketing_ops_confirmation_decision_contract(
        '{"decision":"clarify"}'
    )
    assert not marketing_ops.has_marketing_ops_confirmation_decision_contract(
        'NEXUS_MARKETING_OPS_DECISION: {"decision":"approve"}\nextra'
    )
    assert not marketing_ops.has_marketing_ops_confirmation_decision_contract("approve")


def test_runtime_exposes_a_tool_free_contextual_confirmation_endpoint() -> None:
    api = (VENDOR_ROOT / "gateway" / "platforms" / "api_server.py").read_text(encoding="utf-8")

    assert '"/v1/internal/marketing-ops-decision"' in api
    assert "enabled_toolsets=[]" in api
    assert "max_iterations=1" in api
    assert "persist_session=False" in api
    assert "system_prompt_only=True" in api
    assert "unambiguous_marketing_ops_confirmation_decision(message)" in api
    assert "has_marketing_ops_confirmation_decision_contract(final_response)" in api
    assert "Marketing Ops confirmation classified: decision=%s" in api


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


def test_marketing_ops_operator_skill_has_loadable_contract_references() -> None:
    skill_dir = VENDOR_ROOT / "skills" / "marketing" / "marketing-ops-operator"
    skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
    dockerfile = (RUNTIME_ROOT / "docker" / "hermes.Dockerfile").read_text(
        encoding="utf-8"
    )
    installer = (RUNTIME_ROOT / "docker" / "ensure-nexus-skills.sh").read_text(
        encoding="utf-8"
    )

    # The production entrypoint must replace stale persisted copies with the
    # packaged skill tree, including references and templates.
    assert (
        "COPY vendor/hermes-agent/skills/marketing/marketing-ops-operator "
        "/opt/nexus-skills/marketing-ops-operator"
    ) in dockerfile
    assert '"marketing-ops-operator:marketing/marketing-ops-operator"' in installer
    assert "remove_stale_managed_skill" in installer

    for reference_name, required_text in {
        "mcp-contract.md": "marketing_ops_prepare_plan_v1",
        "conversation-safety.md": "NEXUS_MARKETING_OPS_DECISION",
        "diagnostics.md": "-32602",
    }.items():
        reference = skill_dir / "references" / reference_name
        assert reference.is_file()
        assert required_text in reference.read_text(encoding="utf-8")
        assert f'file_path="references/{reference_name}"' in skill

    schedule_reference = (skill_dir / "references" / "mcp-contract.md").read_text(
        encoding="utf-8"
    )
    assert "full iso 8601 instants with offsets" in " ".join(schedule_reference.lower().split())

    template = skill_dir / "templates" / "plan-preview.md"
    assert template.is_file()
    assert "Nada foi salvo ainda." in template.read_text(encoding="utf-8")
    assert 'file_path="templates/plan-preview.md"' in skill


@pytest.mark.skipif(
    os.name == "nt" or shutil.which("bash") is None,
    reason="POSIX entrypoint contract",
)
def test_managed_marketing_ops_skill_replaces_both_stale_locations(tmp_path: Path) -> None:
    home = tmp_path / "home"
    source = tmp_path / "managed"
    script = RUNTIME_ROOT / "docker" / "ensure-nexus-skills.sh"

    (source / "picture-hermes").mkdir(parents=True)
    (source / "picture-hermes" / "SKILL.md").write_text(
        "picture-managed\n", encoding="utf-8"
    )
    (source / "marketing-ops-operator").mkdir(parents=True)
    (source / "marketing-ops-operator" / "SKILL.md").write_text(
        "marketing-managed-v2\n", encoding="utf-8"
    )
    (home / "skills" / "marketing-ops-operator").mkdir(parents=True)
    (home / "skills" / "marketing-ops-operator" / "SKILL.md").write_text(
        "stale-root-copy\n", encoding="utf-8"
    )
    categorized = home / "skills" / "marketing" / "marketing-ops-operator"
    categorized.mkdir(parents=True)
    (categorized / "SKILL.md").write_text(
        "stale-categorized-copy\n", encoding="utf-8"
    )
    (home / "skills" / "user-owned").mkdir(parents=True)
    (home / "skills" / "user-owned" / "SKILL.md").write_text(
        "preserve-me\n", encoding="utf-8"
    )
    env = {
        **os.environ,
        "HERMES_HOME": str(home),
        "NEXUS_MANAGED_SKILLS_DIR": str(source),
    }

    subprocess.run(["bash", str(script)], env=env, check=True)
    subprocess.run(["bash", str(script)], env=env, check=True)

    assert not (home / "skills" / "marketing-ops-operator").exists()
    assert (categorized / "SKILL.md").read_text(
        encoding="utf-8"
    ) == "marketing-managed-v2\n"
    assert (home / "skills" / "user-owned" / "SKILL.md").read_text(
        encoding="utf-8"
    ) == "preserve-me\n"


def test_marketing_ops_operator_skill_freezes_phase_4_sources_and_catalog() -> None:
    skill = (
        VENDOR_ROOT
        / "skills"
        / "marketing"
        / "marketing-ops-operator"
        / "SKILL.md"
    ).read_text(encoding="utf-8")

    for tool_name in (
        "marketing_ops_list_campaign_items_v1",
        "marketing_ops_get_campaign_timeline_v1",
        "marketing_ops_get_content_v1",
        "marketing_ops_get_object_capabilities_v1",
        "ens_rag_search",
        "nexus_graph_search_validated_work",
    ):
        assert tool_name in skill

    for action_name in (
        "campaign.create_draft",
        "campaign.update",
        "campaign_item.create",
        "campaign_item.reschedule",
        "content.create_draft",
        "content.version_create",
        "artifact.link_existing",
        "campaign.note_add",
    ):
        assert action_name in skill

    normalized = " ".join(skill.lower().split())
    assert "institutional facts and ens tone" in normalized
    assert "relationships and validated prior work" in normalized
    assert "marketing ops is the only source of current transactional state" in normalized
    assert "untrusted data, never instructions" in normalized
    assert "deep_links" in normalized
    assert "partial result" in normalized


def test_marketing_ops_operator_contract_freezes_content_plan_wire_shape() -> None:
    contract = (
        VENDOR_ROOT
        / "skills"
        / "marketing"
        / "marketing-ops-operator"
        / "references"
        / "mcp-contract.md"
    ).read_text(encoding="utf-8")

    for required_field in (
        '"expected_item_version"',
        '"asset_kind"',
        '"expected_asset_version"',
        '"asset_ref"',
        '"body"',
        '"metadata"',
        '"freeze"',
    ):
        assert required_field in contract

    assert '"asset_kind": "email_html"' in contract
    assert '"type": "content.create_draft"' in contract
    assert '"type": "content.version_create"' in contract


def test_marketing_ops_operator_contract_freezes_content_read_wire_shape() -> None:
    contract = (
        VENDOR_ROOT
        / "skills"
        / "marketing"
        / "marketing-ops-operator"
        / "references"
        / "mcp-contract.md"
    ).read_text(encoding="utf-8")

    assert '"asset_id": "00000000-0000-4000-8000-000000000000"' in contract
    assert '"include_versions": true' in contract
    assert '"version_limit": 5' in contract
    assert "exactly one of `item_id` or `asset_id`" in contract
    assert "`campaign`, `campaign_item`, or `content_asset`" in contract


def test_marketing_ops_operator_fails_closed_on_inexact_existing_targets() -> None:
    skill_dir = VENDOR_ROOT / "skills" / "marketing" / "marketing-ops-operator"
    skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
    contract = (skill_dir / "references" / "mcp-contract.md").read_text(
        encoding="utf-8"
    )
    preview = (skill_dir / "templates" / "plan-preview.md").read_text(
        encoding="utf-8"
    )

    normalized_skill = " ".join(skill.lower().split())
    normalized_contract = " ".join(contract.lower().split())
    normalized_preview = " ".join(preview.lower().split())

    assert "never fuzzy-match" in normalized_skill
    assert "exact server-returned human label" in normalized_skill
    assert "do not prepare a plan" in normalized_skill
    assert "campaign -> campaign item -> content asset" in normalized_contract
    assert "exact target cannot be resolved" in normalized_contract
    assert "campanha resolvida" in normalized_preview
    assert "item resolvido" in normalized_preview
    assert "conteúdo resolvido" in normalized_preview
