#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path


DELEGATION_BLOCK = re.compile(
    r"(?P<before>\n*)\[MARKETING_OPS_DELEGATION\][\s\S]*?"
    r"\[/MARKETING_OPS_DELEGATION\](?P<after>\n*)"
)


def scrub_content(content: str) -> str:
    def replace(match: re.Match[str]) -> str:
        return "\n" * max(len(match.group("before")), len(match.group("after")))

    return DELEGATION_BLOCK.sub(replace, content)


def scrub_database(database_path: str | Path) -> int:
    path = Path(database_path)
    if not path.exists():
        return 0

    connection = sqlite3.connect(path, timeout=30)
    try:
        table = connection.execute(
            "select 1 from sqlite_master where type = 'table' and name = 'messages'"
        ).fetchone()
        if table is None:
            return 0

        rows = connection.execute(
            "select id, content from messages "
            "where instr(coalesce(content, ''), '[MARKETING_OPS_DELEGATION]') > 0"
        ).fetchall()
        changed = []
        for message_id, content in rows:
            cleaned = scrub_content(content)
            if cleaned != content:
                changed.append((cleaned, message_id))
        with connection:
            connection.executemany("update messages set content = ? where id = ?", changed)
        return len(changed)
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    args = parser.parse_args()
    changed = scrub_database(args.database)
    print(f"[hermes-api] scrubbed persisted Marketing Ops delegations: {changed}")


if __name__ == "__main__":
    main()
