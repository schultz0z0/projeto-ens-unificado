from __future__ import annotations

import importlib.util
import sqlite3
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scrub-marketing-ops-delegations.py"


def load_script():
    assert SCRIPT_PATH.exists(), "SessionDB delegation scrubber is missing"
    spec = importlib.util.spec_from_file_location("scrub_marketing_ops_delegations", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_scrub_database_removes_only_delegation_blocks_and_is_idempotent(tmp_path: Path) -> None:
    module = load_script()
    database_path = tmp_path / "state.db"
    connection = sqlite3.connect(database_path)
    connection.execute(
        "create table messages (id integer primary key, content text, tool_calls text)"
    )
    connection.executemany(
        "insert into messages (content, tool_calls) values (?, ?)",
        [
            (
                "Pedido original\n\n[MARKETING_OPS_DELEGATION]\n"
                "delegation_token: header.payload.signature\n"
                "[/MARKETING_OPS_DELEGATION]\n\nContexto preservado",
                None,
            ),
            (
                "Mensagem sem delegacao",
                '[{"function":{"name":"marketing_ops_list_campaigns_v1",'
                '"arguments":"{\\"delegation_token\\":\\"stale-tool-token\\",'
                '\\"status\\":\\"draft\\"}"}}]',
            ),
            (
                "Inicio\n[MARKETING_OPS_DELEGATION]\nold-1\n[/MARKETING_OPS_DELEGATION]\n"
                "Meio\n[MARKETING_OPS_DELEGATION]\nold-2\n[/MARKETING_OPS_DELEGATION]\nFim",
                None,
            ),
            (
                "Tool call ja redigida",
                '[{"function":{"arguments":"{\\"delegation_token\\":'
                '\"[REDACTED_EPHEMERAL_DELEGATION]\\"}"}}]',
            ),
            ("Mensagem e tool call limpos", '[{"name":"outra_tool"}]'),
        ],
    )
    connection.commit()
    connection.close()

    assert module.scrub_database(database_path) == 3

    connection = sqlite3.connect(database_path)
    rows = connection.execute(
        "select content, tool_calls from messages order by id"
    ).fetchall()
    connection.close()
    assert [row[0] for row in rows] == [
        "Pedido original\n\nContexto preservado",
        "Mensagem sem delegacao",
        "Inicio\nMeio\nFim",
        "Tool call ja redigida",
        "Mensagem e tool call limpos",
    ]
    assert "stale-tool-token" not in rows[1][1]
    assert "delegation_token" in rows[1][1]
    assert rows[3][1] == (
        '[{"function":{"arguments":"{\\"delegation_token\\":'
        '\"[REDACTED_EPHEMERAL_DELEGATION]\\"}"}}]'
    )
    assert rows[4][1] == '[{"name":"outra_tool"}]'
    assert module.scrub_database(database_path) == 0
