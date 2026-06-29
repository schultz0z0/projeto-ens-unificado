"""neo4j_admin.py - CLI provisioning de tenants Neo4j.

Uso (via docker compose exec):
  docker compose exec hermes-api python /opt/neo4j_admin.py create-tenant acme
  docker compose exec hermes-api python /opt/neo4j_admin.py list-tenants
  docker compose exec hermes-admin python /opt/neo4j_admin.py delete-tenant acme
  docker compose exec hermes-api python /opt/neo4j_admin.py stats

Operacoes:
  create-tenant ID [--memory 256MB]
  delete-tenant ID  [--force]
  list-tenants
  stats ID
  init  (cria databases default: nexus_system, nexus_tenant_template)
"""

from __future__ import annotations
import os
import re
import sys
from typing import Literal

TENANT_ID_PATTERN = re.compile(r"^[a-z0-9_-]{3,64}$")

def validate_tenant_id(tid: str) -> None:
    """Levanta ValueError se tenant_id eh invalido."""
    if not TENANT_ID_PATTERN.match(tid):
        raise ValueError(
            f"tenant_id invalido: {tid!r}. "
            "Esperado: [a-z0-9_-], 3-64 chars. "
            "Exemplos validos: 'acme', 'globex-2024', 'tenant_abc'"
        )

def get_driver():
    """Init driver Neo4j (conecta como admin no database 'neo4j' system)."""
    from neo4j import GraphDatabase
    url = os.environ.get("NEXUS_GRAPH_URL", "bolt://neo4j:7687")
    user = os.environ.get("NEXUS_NEO4J_USER", "neo4j")
    pwd = os.environ.get("NEXUS_NEO4J_PASSWORD", "change-me")
    if pwd == "change-me":
        print("[WARN] Usando senha default 'change-me'. Defina NEXUS_NEO4J_PASSWORD.", file=sys.stderr)
    return GraphDatabase.driver(url, auth=(user, pwd))

def tenant_db_name(tid: str) -> str:
    """Mapeia tenant_id pra database name: 'acme' -> 'nexus_tenant_acme'."""
    return "nexus_tenant_" + tid

def create_tenant(tid: str, memory: str = "256MB") -> bool:
    """Cria database tenant e indices basicos. Retorna True se criado."""
    validate_tenant_id(tid)
    db_name = tenant_db_name(tid)
    driver = get_driver()
    try:
        with driver.session(database="system") as session:
            # Verificar se ja existe
            check = session.run(
                "SHOW DATABASES YIELD name WHERE name = $db RETURN name",
                db=db_name
            )
            existing = [dict(r) for r in check]
            if existing:
                print(f"[SKIP] {db_name} ja existe")
                return False
            # CREATE DATABASE com memory
            session.run(
                f"CREATE DATABASE $db WAIT",
                db=db_name
            )
            print(f"[OK] Database criado: {db_name}")
        # Criar indices no database do tenant
        with driver.session(database=db_name) as session:
            for stmt in [
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Module) REQUIRE n.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Function) REQUIRE n.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Class) REQUIRE n.id IS UNIQUE",
                "CREATE INDEX IF NOT EXISTS FOR (n:Module) ON (n.label)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Function) ON (n.label)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Class) ON (n.label)",
            ]:
                try:
                    session.run(stmt)
                except Exception as e:
                    print(f"[WARN] indice skipped ({e})")
            print(f"[OK] Indices criados em {db_name}")
        return True
    finally:
        driver.close()

def delete_tenant(tid: str, force: bool = False) -> bool:
    """Delete tenant database. Retorna True se deletado."""
    validate_tenant_id(tid)
    db_name = tenant_db_name(tid)
    if not force:
        confirm = input(f"Tem certeza que quer DELETAR {db_name}? (sim/nao): ")
        if confirm.lower() != "sim":
            print("[CANCELLED]")
            return False
    driver = get_driver()
    try:
        with driver.session(database="system") as session:
            # Verificar se existe
            check = session.run(
                "SHOW DATABASES YIELD name WHERE name = $db RETURN name",
                db=db_name
            )
            if not list(check):
                print(f"[SKIP] {db_name} nao existe")
                return False
            # DROP DATABASE (Neo4j 4.0+)
            session.run(f"DROP DATABASE $db IF EXISTS WAIT", db=db_name)
            print(f"[OK] Database deletado: {db_name}")
        return True
    finally:
        driver.close()

def list_tenants() -> list[dict]:
    """Lista todos os tenants (databases que comecam com 'nexus_tenant_')."""
    driver = get_driver()
    try:
        with driver.session(database="system") as session:
            result = session.run(
                "SHOW DATABASES YIELD name, address WHERE name STARTS WITH 'nexus_tenant_' "
                "RETURN name, address"
            )
            rows = [dict(r) for r in result]
            return rows
    finally:
        driver.close()

def tenant_stats(tid: str) -> dict:
    """Stats detalhadas de um tenant (node count, etc)."""
    db_name = tenant_db_name(tid)
    driver = get_driver()
    try:
        with driver.session(database=db_name) as session:
            node_count = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]
            edge_count = session.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
            labels = list(session.run("CALL db.labels() YIELD label RETURN label"))
        return {
            "tenant_id": tid,
            "database": db_name,
            "nodes": node_count,
            "edges": edge_count,
            "labels": [dict(l)["label"] for l in labels],
        }
    except Exception as e:
        return {"tenant_id": tid, "error": str(e)}
    finally:
        driver.close()

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Neo4j admin CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # create-tenant
    p = sub.add_parser("create-tenant", help="Cria database tenant")
    p.add_argument("tenant_id")
    p.add_argument("--memory", default="256MB")

    # delete-tenant
    p = sub.add_parser("delete-tenant", help="Deleta database tenant")
    p.add_argument("tenant_id")
    p.add_argument("--force", action="store_true")

    # list-tenants
    sub.add_parser("list-tenants", help="Lista todos os tenants")

    # stats
    p = sub.add_parser("stats", help="Stats de um tenant")
    p.add_argument("tenant_id")

    args = parser.parse_args()

    try:
        if args.cmd == "create-tenant":
            create_tenant(args.tenant_id, args.memory)
        elif args.cmd == "delete-tenant":
            delete_tenant(args.tenant_id, args.force)
        elif args.cmd == "list-tenants":
            tenants = list_tenants()
            if not tenants:
                print("(nenhum tenant)")
            for t in tenants:
                print(f"  - {t['name']} ({t.get('address', '?')})")
        elif args.cmd == "stats":
            import json
            stats = tenant_stats(args.tenant_id)
            print(json.dumps(stats, indent=2))
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
