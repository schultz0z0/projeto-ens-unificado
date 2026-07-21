from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "rag": Path("D:/Projetos SaaS/PROJETO ENS/Hermes-RAG-MCP/.env"),
    "chat": Path("D:/Projetos SaaS/PROJETO ENS/Nexus-AI-2.0/.env"),
    "hermes": Path("D:/Projetos SaaS/PROJETO ENS/nexus-ai-hermes/.env"),
}


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def first(envs: dict[str, dict[str, str]], *pairs: tuple[str, str]) -> str | None:
    for source, key in pairs:
        value = envs.get(source, {}).get(key)
        if value is not None and value.strip() != "":
            return value
    return None


def main() -> None:
    envs = {name: parse_env(path) for name, path in SOURCES.items()}
    updates = {
        # App/chat Supabase
        "NEXUS_APP_SUPABASE_URL": first(envs, ("chat", "SUPABASE_URL"), ("chat", "VITE_SUPABASE_URL")),
        "NEXUS_APP_SUPABASE_ANON_KEY": first(envs, ("chat", "SUPABASE_ANON_KEY"), ("chat", "VITE_SUPABASE_ANON_KEY")),
        "NEXUS_APP_SUPABASE_SERVICE_ROLE_KEY": first(envs, ("chat", "SUPABASE_SERVICE_ROLE_KEY")),
        # RAG Supabase / ENS
        "NEXUS_RAG_SUPABASE_URL": first(envs, ("rag", "SUPABASE_URL")),
        "NEXUS_RAG_SUPABASE_SERVICE_ROLE_KEY": first(envs, ("rag", "SUPABASE_SERVICE_ROLE_KEY")),
        "NEXUS_ENS_API_URL": first(envs, ("rag", "ENS_API_URL")),
        "NEXUS_ENS_API_KEY": first(envs, ("rag", "ENS_API_KEY")),
        "NEXUS_ENS_API_KEY_HEADER": first(envs, ("rag", "ENS_API_KEY_HEADER")),
        "NEXUS_OPENAI_EMBEDDING_MODEL": first(envs, ("rag", "OPENAI_EMBEDDING_MODEL")),
        "NEXUS_OPENAI_EMBEDDING_BASE_URL": first(envs, ("rag", "OPENAI_EMBEDDING_BASE_URL")),
        # App Supabase / conexão PostgreSQL compartilhada
        "NEXUS_SUPABASE_PROJECT_REF": first(envs, ("chat", "SUPABASE_PROJECT_REF")),
        "NEXUS_SUPABASE_PROJECT_ID": first(envs, ("chat", "SUPABASE_PROJECT_ID")),
        "NEXUS_SUPABASE_DB_PASSWORD": first(envs, ("chat", "SUPABASE_DB_PASSWORD")),
        "NEXUS_SUPABASE_DATABASE_URL": first(envs, ("chat", "SUPABASE_DATABASE_URL")),
        "NEXUS_SUPABASE_JWT_SECRET": first(envs, ("chat", "SUPABASE_JWT_SECRET")),
        "NEXUS_SUPABASE_ACCESS_TOKEN": first(envs, ("chat", "SUPABASE_ACCESS_TOKEN")),
        # Hermes / providers
        "NEXUS_HERMES_API_KEY": first(envs, ("chat", "HERMES_API_KEY"), ("hermes", "HERMES_API_KEY_CORE")),
        "NEXUS_HERMES_MODEL_NAME": first(envs, ("chat", "HERMES_MODEL_NAME")),
        "NEXUS_HERMES_SESSIONS_API_ENABLED": first(envs, ("chat", "HERMES_SESSIONS_API_ENABLED")),
        "NEXUS_HERMES_STREAM_TIMEOUT_MS": first(envs, ("chat", "HERMES_STREAM_TIMEOUT_MS")),
        "NEXUS_HERMES_REQUEST_TIMEOUT_MS": first(envs, ("chat", "HERMES_REQUEST_TIMEOUT_MS")),
        "NEXUS_OPENAI_API_KEY": first(envs, ("rag", "OPENAI_API_KEY"), ("hermes", "OPENAI_API_KEY")),
        "NEXUS_GEMINI_API_KEY": first(envs, ("hermes", "GEMINI_API_KEY")),
        "NEXUS_GOOGLE_API_KEY": first(envs, ("hermes", "GOOGLE_API_KEY")),
        "NEXUS_OPENROUTER_API_KEY": first(envs, ("hermes", "OPENROUTER_API_KEY")),
        "NEXUS_ANTHROPIC_API_KEY": first(envs, ("hermes", "ANTHROPIC_API_KEY")),
    }
    updates = {key: value for key, value in updates.items() if value is not None}

    env_path = ROOT / ".env"
    source_lines = env_path.read_text(encoding="utf-8", errors="ignore").splitlines() if env_path.exists() else (ROOT / ".env.example").read_text(encoding="utf-8").splitlines()
    seen: set[str] = set()
    changed: list[str] = []
    output: list[str] = []
    for line in source_lines:
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key = line.split("=", 1)[0].strip()
            if key in updates:
                output.append(f"{key}={updates[key]}")
                seen.add(key)
                changed.append(key)
            else:
                output.append(line)
        else:
            output.append(line)

    missing = [key for key in updates if key not in seen]
    if missing:
        output.append("")
        output.append("# ---------- Migrado automaticamente dos .env isolados sem imprimir valores ----------")
        for key in missing:
            output.append(f"{key}={updates[key]}")
            changed.append(key)

    env_path.write_text("\n".join(output) + "\n", encoding="utf-8")
    print(f"UPDATED_KEYS_COUNT={len(changed)}")
    for key in sorted(changed):
        print(key)


if __name__ == "__main__":
    main()
