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
    connection.execute("create table messages (id integer primary key, content text)")
    connection.executemany(
        "insert into messages (content) values (?)",
        [
            (
                "Pedido original\n\n[MARKETING_OPS_DELEGATION]\n"
                "delegation_token: header.payload.signature\n"
                "[/MARKETING_OPS_DELEGATION]\n\nContexto preservado",
            ),
            ("Mensagem sem delegacao",),
            (
                "Inicio\n[MARKETING_OPS_DELEGATION]\nold-1\n[/MARKETING_OPS_DELEGATION]\n"
                "Meio\n[MARKETING_OPS_DELEGATION]\nold-2\n[/MARKETING_OPS_DELEGATION]\nFim",
            ),
        ],
    )
    connection.commit()
    connection.close()

    assert module.scrub_database(database_path) == 2

    connection = sqlite3.connect(database_path)
    contents = [row[0] for row in connection.execute("select content from messages order by id")]
    connection.close()
    assert contents == [
        "Pedido original\n\nContexto preservado",
        "Mensagem sem delegacao",
        "Inicio\nMeio\nFim",
    ]
    assert module.scrub_database(database_path) == 0
