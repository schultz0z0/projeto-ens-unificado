"""neo4j_admin.py - CLI provisioning Neo4j multi-tenant + multi-user (v3.8+).

Gerencia databases por tenant E por user (dentro de tenant).

Uso:
  docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme
  docker compose exec hermes-api python /opt/neo4j_admin.py create-user-db acme alice-uuid-123
  docker compose exec hermes-api python /opt/neo4j_admin.py list-databases
  docker compose exec hermes-api python /opt/neo4j_admin.py delete-user-db acme alice-uuid-123

Database naming:
  system: neo4j (admin)
  tenant: nexus_tenant_<tenant_id>
  user:   nexus_tenant_<tenant_id>_user_<user_id>
"""

from __future__ import annotations
import os
import re
import sys
from typing import Literal

TENANT_ID_PATTERN = re.compile(r"^[a-z0-9_-]{3,64}$")
USER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{3,128}$")


def validate_tenant_id(tid: str) -> None:
    if not TENANT_ID_PATTERN.match(tid):
        raise ValueError(
            f"tenant_id invalido: {tid!r}. Esperado: [a-z0-9_-], 3-64 chars."
        )


def validate_user_id(uid: str) -> None:
    if not USER_ID_PATTERN.match(uid):
        raise ValueError(
            f"user_id invalido: {uid!r}. Esperado: [a-zA-Z0-9_-], 3-128 chars (UUID Supabase)."
        )


def tenant_db_name(tid: str) -> str:
    return "nexus_tenant_" + tid


def user_db_name(tid: str, uid: str) -> str:
    return "nexus_tenant_" + tid + "_user_" + uid


def get_driver():
    from neo4j import GraphDatabase
    url = os.environ.get("NEXUS_GRAPH_URL", "bolt://neo4j:7687")
    user = os.environ.get("NEXUS_NEO4J_USER", "neo4j")
    pwd = os.environ.get("NEXUS_NEO4J_PASSWORD", "change-me")
    return GraphDatabase.driver(url, auth=(user, pwd))


def _execute_admin(driver, query: str, **params):
    """Executa query como admin (system DB)."""
    with driver.session(database="system") as session:
        result = session.run(query, **params)
        return list(result)


def create_tenant_db(tid: str, memory: str = "256MB") -> bool:
    """Cria database por tenant + indices basicos."""
    validate_tenant_id(tid)
    db_name = tenant_db_name(tid)
    driver = get_driver()
    try:
        existing = _execute_admin(
            driver, "SHOW DATABASES YIELD name WHERE name = $db RETURN name", db=db_name
        )
        if existing:
            print(f"[SKIP] {db_name} ja existe")
            return False
        _execute_admin(driver, "CREATE DATABASE $db WAIT", db=db_name)
        print(f"[OK] Tenant database criado: {db_name}")
        with driver.session(database=db_name) as s:
            for stmt in [
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Module) REQUIRE n.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Function) REQUIRE n.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Class) REQUIRE n.id IS UNIQUE",
                "CREATE INDEX IF NOT EXISTS FOR (n:Module) ON (n.label)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Function) ON (n.label)",
            ]:
                try:
                    s.run(stmt)
                except Exception:
                    pass
        print(f"[OK] Indices criados em {db_name}")
        return True
    finally:
        driver.close()


def create_user_db(tid: str, uid: str, memory: str = "128MB") -> bool:
    """Cria database PRIVADA por user dentro do tenant.

    Uso: cada user tem sua database propria (escopo user).
    """
    validate_tenant_id(tid)
    validate_user_id(uid)
    db_name = user_db_name(tid, uid)
    driver = get_driver()
    try:
        # Verificar se tenant existe
        existing = _execute_admin(
            driver, "SHOW DATABASES YIELD name WHERE name = $db RETURN name", db=db_name
        )
        if existing:
            print(f"[SKIP] {db_name} ja existe")
            return False
        _execute_admin(driver, "CREATE DATABASE $db WAIT", db=db_name)
        print(f"[OK] User database criado: {db_name}")
        with driver.session(database=db_name) as s:
            for stmt in [
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Preference) REQUIRE n.id IS UNIQUE",
                "CREATE INDEX IF NOT EXISTS FOR (n:Note) ON (n.created_at)",
            ]:
                try:
                    s.run(stmt)
                except Exception:
                    pass
        print(f"[OK] User indices criados em {db_name}")
        return True
    finally:
        driver.close()


def delete_database(db_name: str, force: bool = False) -> bool:
    """Deleta database (cuidado!)."""
    if not force:
        confirm = input(f"DELETAR database {db_name}? (digite DELETAR): ")
        if confirm != "DELETAR":
            print("[CANCELLED]")
            return False
    driver = get_driver()
    try:
        existing = _execute_admin(
            driver, "SHOW DATABASES YIELD name WHERE name = $db RETURN name", db=db_name
        )
        if not list(existing):
            print(f"[SKIP] {db_name} nao existe")
            return False
        _execute_admin(driver, "DROP DATABASE $db IF EXISTS WAIT", db=db_name)
        print(f"[OK] Database deletado: {db_name}")
        return True
    finally:
        driver.close()


def list_databases(pattern: str = "nexus_") -> list[dict]:
    """Lista databases Neo4j (filtradas por pattern)."""
    driver = get_driver()
    try:
        rows = _execute_admin(
            driver,
            f"SHOW DATABASES YIELD name, address WHERE name STARTS WITH $pat RETURN name, address",
            pat=pattern,
        )
        return [dict(r) for r in rows]
    finally:
        driver.close()


def database_stats(db_name: str) -> dict:
    """Stats de uma database."""
    driver = get_driver()
    try:
        with driver.session(database=db_name) as s:
            node_count = s.run("MATCH (n) RETURN count(n) AS c").single()["c"]
            edge_count = s.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
            labels = list(s.run("CALL db.labels() YIELD label RETURN label ORDER BY label"))
        return {
            "database": db_name,
            "nodes": node_count,
            "edges": edge_count,
            "labels": [dict(l)["label"] for l in labels],
        }
    except Exception as e:
        return {"database": db_name, "error": str(e)}
    finally:
        driver.close()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Neo4j admin CLI (v3.8+ multi-tenant + multi-user)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # create-tenant
    p = sub.add_parser("create-tenant")
    p.add_argument("tenant_id")
    p.add_argument("--memory", default="256MB")

    # delete-tenant
    p = sub.add_parser("delete-tenant")
    p.add_argument("tenant_id")
    p.add_argument("--force", action="store_true")

    # create-user-db
    p = sub.add_parser("create-user-db")
    p.add_argument("tenant_id")
    p.add_argument("user_id")
    p.add_argument("--memory", default="128MB")

    # delete-user-db
    p = sub.add_parser("delete-user-db")
    p.add_argument("tenant_id")
    p.add_argument("user_id")
    p.add_argument("--force", action="store_true")

    # list
    sub.add_parser("list-databases")

    # stats
    p = sub.add_parser("stats")
    p.add_argument("database")

    args = parser.parse_args()

    try:
        if args.cmd == "create-tenant":
            create_tenant_db(args.tenant_id, args.memory)
        elif args.cmd == "delete-tenant":
            delete_database(tenant_db_name(args.tenant_id), args.force)
        elif args.cmd == "create-user-db":
            create_user_db(args.tenant_id, args.user_id, args.memory)
        elif args.cmd == "delete-user-db":
            delete_database(user_db_name(args.tenant_id, args.user_id), args.force)
        elif args.cmd == "list-databases":
            dbs = list_databases()
            if not dbs:
                print("(nenhum database nexus_*)")
            for d in dbs:
                print("  -", d["name"], "(", d.get("address", "?"), ")")
        elif args.cmd == "stats":
            import json
            stats = database_stats(args.database)
            print(json.dumps(stats, indent=2))
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
