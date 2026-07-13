#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path


DELEGATION_BLOCK = re.compile(
    r"(?P<before>\n*)\[MARKETING_OPS_DELEGATION\][\s\S]*?"
    r"\[/MARKETING_OPS_DELEGATION\](?P<after>\n*)"
)
REDACTED_DELEGATION = "[REDACTED_EPHEMERAL_DELEGATION]"
DELEGATION_JSON_FIELD = re.compile(
    r'(?P<prefix>"delegation_token"\s*:\s*)"(?:\\.|[^"\\])*"',
    re.IGNORECASE,
)


def scrub_content(content: str) -> str:
    def replace(match: re.Match[str]) -> str:
        return "\n" * max(len(match.group("before")), len(match.group("after")))

    return DELEGATION_BLOCK.sub(replace, content)


def scrub_tool_calls(value):
    if isinstance(value, dict):
        return {
            key: (
                REDACTED_DELEGATION
                if str(key).lower() == "delegation_token"
                else scrub_tool_calls(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [scrub_tool_calls(item) for item in value]
    if not isinstance(value, str) or "delegation_token" not in value.lower():
        return value
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return DELEGATION_JSON_FIELD.sub(
            lambda match: f'{match.group("prefix")}"{REDACTED_DELEGATION}"',
            value,
        )
    if not isinstance(parsed, (dict, list)):
        return value
    redacted = scrub_tool_calls(parsed)
    if redacted == parsed:
        return value
    return json.dumps(redacted, ensure_ascii=False, separators=(",", ":"))


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

        columns = {
            row[1] for row in connection.execute("pragma table_info(messages)").fetchall()
        }
        has_tool_calls = "tool_calls" in columns
        tool_calls_select = "tool_calls" if has_tool_calls else "null as tool_calls"
        tool_calls_filter = (
            " or instr(coalesce(tool_calls, ''), 'delegation_token') > 0"
            if has_tool_calls else ""
        )
        rows = connection.execute(
            f"select id, content, {tool_calls_select} from messages "
            "where instr(coalesce(content, ''), '[MARKETING_OPS_DELEGATION]') > 0"
            f"{tool_calls_filter}"
        ).fetchall()
        changed = []
        for message_id, content, tool_calls in rows:
            cleaned_content = scrub_content(content) if content else content
            cleaned_tool_calls = scrub_tool_calls(tool_calls) if tool_calls else tool_calls
            if cleaned_content != content or cleaned_tool_calls != tool_calls:
                changed.append((cleaned_content, cleaned_tool_calls, message_id))
        with connection:
            if has_tool_calls:
                connection.executemany(
                    "update messages set content = ?, tool_calls = ? where id = ?",
                    changed,
                )
            else:
                connection.executemany(
                    "update messages set content = ? where id = ?",
                    [(content, message_id) for content, _, message_id in changed],
                )
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
