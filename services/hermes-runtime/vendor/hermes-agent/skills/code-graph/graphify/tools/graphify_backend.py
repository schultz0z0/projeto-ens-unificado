"""graphify_backend.py - Backend Neo4j multi-tenant + multi-user (v3.8+).

White-label Nexus: 3 niveis de isolamento via Neo4j multi-database:

  Tenants (empresas): cada empresa 1 database Neo4j
  Users (employees): cada user 1 database PRIVADA dentro do tenant
  Scopes: 'tenant' (compartilhado) ou 'user' (privado)

Hierarquia:
  - nexus_tenant_<tenant_id>            (global, todos os users veem)
  - nexus_tenant_<tenant_id>_user_<user_id>   (privado, so user_id ve)

Modos (env NEXUS_GRAPH_BACKEND):
  - local                       : graph.json local (NetworkX, sem servidor)
  - neo4j-self-hosted           : 1 instancia Neo4j, 1 DB compartilhada
  - neo4j-multi-tenant-user     : Neo4j multi-DB, com user_id scoped (PRODUCAO)

USO:
    from graphify_backend import GraphBackend

    # Tenant-only (compartilhado entre todos os users)
    backend_t = GraphBackend(tenant_id='acme', scope='tenant')

    # User-private (cada user tem seu grafo)
    backend_u = GraphBackend(
        tenant_id='acme', user_id='alice', scope='user'
    )

    backend.query("MATCH (n:Module) RETURN n LIMIT 10")
"""

from __future__ import annotations
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Literal

BackendMode = Literal["local", "neo4j-self-hosted", "neo4j-multi-tenant-user"]
TENANT_ID_PATTERN = re.compile(r"^[a-z0-9_-]{3,64}$")
USER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{3,128}$")  # Supabase UUID formato
Scope = Literal["tenant", "user"]


def detect_backend_mode() -> BackendMode:
    """Detecta backend via NEXUS_GRAPH_BACKEND env var."""
    env = os.environ.get("NEXUS_GRAPH_BACKEND", "neo4j-multi-tenant-user").lower()
    valid = ("local", "neo4j-self-hosted", "neo4j-multi-tenant-user")
    if env not in valid:
        sys.stderr.write(
            "[graphify-backend] WARN: NEXUS_GRAPH_BACKEND=" + env +
            " invalido (esperado " + str(valid) + "), usando neo4j-multi-tenant-user\n"
        )
        return "neo4j-multi-tenant-user"
    return env  # type: ignore[return-value]


def detect_tenant_id() -> str | None:
    """Detecta tenant_id via env var ou None."""
    tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if tenant_id and not TENANT_ID_PATTERN.match(tenant_id):
        sys.stderr.write(
            "[graphify-backend] WARN: NEXUS_TENANT_ID=" + tenant_id +
            " invalido (esperado [a-z0-9_-]{3,64})\n"
        )
        return None
    return tenant_id


def detect_user_id() -> str | None:
    """Detecta user_id via env var ou None."""
    user_id = os.environ.get("NEXUS_USER_ID")
    if user_id and not USER_ID_PATTERN.match(user_id):
        sys.stderr.write(
            "[graphify-backend] WARN: NEXUS_USER_ID=" + user_id +
            " invalido (esperado [a-zA-Z0-9_-]{3,128})\n"
        )
        return None
    return user_id


def tenant_database_name(tenant_id: str | None) -> str:
    """Mapeia tenant_id -> database name do 'tenant graph'."""
    if tenant_id is None:
        return "neo4j"
    safe = re.sub(r"[^a-z0-9_-]", "", tenant_id.lower())[:63]
    return "nexus_tenant_" + safe


def user_database_name(tenant_id: str | None, user_id: str | None) -> str:
    """Mapeia (tenant_id, user_id) -> database name do 'user graph'."""
    if tenant_id is None or user_id is None:
        return "neo4j"
    safe_tenant = re.sub(r"[^a-z0-9_-]", "", tenant_id.lower())[:63]
    safe_user = re.sub(r"[^a-zA-Z0-9_-]", "", user_id)[:63]
    return "nexus_tenant_" + safe_tenant + "_user_" + safe_user


def resolve_database(mode: BackendMode, tenant_id: str | None, user_id: str | None, scope: Scope) -> str:
    """Resolve database name baseado em mode + tenant + user + scope."""
    if mode == "local":
        return "neo4j"  # ignorado em modo local
    if mode == "neo4j-self-hosted":
        return "neo4j"  # 1 DB so
    # neo4j-multi-tenant-user
    if scope == "user" and user_id:
        return user_database_name(tenant_id, user_id)
    return tenant_database_name(tenant_id)


class GraphBackend:
    """Backend Neo4j multi-tenant + multi-user (v3.8+)."""

    def __init__(
        self,
        mode: BackendMode | None = None,
        url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        tenant_id: str | None = None,
        user_id: str | None = None,
        scope: Scope = "tenant",
        graph_json: str | None = None,
        admin: bool = False,
    ):
        """
        Args:
            mode: 'local', 'neo4j-self-hosted', 'neo4j-multi-tenant-user'
                  (auto-detecta de NEXUS_GRAPH_BACKEND env)
            url: Neo4j Bolt URL
            username: Neo4j user
            password: Neo4j password
            tenant_id: Empresa/workspace ID
            user_id: User individual ID (UUID Supabase)
            scope: 'tenant' (compartilhado) ou 'user' (privado)
            graph_json: Apenas modo 'local'
            admin: True = conecta como system admin (CREATE DATABASE, etc)
        """
        self.mode = mode or detect_backend_mode()
        self.tenant_id = tenant_id if tenant_id is not None else detect_tenant_id()
        self.user_id = user_id if user_id is not None else detect_user_id()
        self.scope = scope
        self.url = url or os.environ.get("NEXUS_GRAPH_URL", "bolt://neo4j:7687")
        self.username = username or os.environ.get("NEXUS_NEO4J_USER", "neo4j")
        self.password = password or os.environ.get("NEXUS_NEO4J_PASSWORD", "change-me")
        self.graph_json = graph_json or os.environ.get(
            "NEXUS_GRAPH_JSON", "/opt/data/graphify-out/graph.json"
        )
        self.admin = admin
        # Resolve database name baseado em scope
        if self.admin:
            self.database = "neo4j"  # system database (CREATE DATABASE, etc)
        elif self.scope == "user" and self.user_id:
            self.database = user_database_name(self.tenant_id, self.user_id)
        else:
            self.database = tenant_database_name(self.tenant_id)
        self._driver = None
        self._connected = False

    def _connect(self):
        if self._connected:
            return
        if self.mode == "local":
            self._connected = True
            return
        try:
            from neo4j import GraphDatabase
        except ImportError as e:
            raise RuntimeError("neo4j nao instalado. Use: pip install graphifyy[all]") from e
        self._driver = GraphDatabase.driver(self.url, auth=(self.username, self.password))
        self._connected = True

    def _session(self):
        self._connect()
        return self._driver.session(database=self.database)

    def query(self, cypher: str, params: dict | None = None) -> list[dict]:
        """Query Cypher scoped per-tenant ou per-user."""
        if self.mode == "local":
            return self._query_local(cypher)
        with self._session() as session:
            result = session.run(cypher, params or {})
            return [dict(record) for record in result]

    def _query_local(self, query_text: str) -> list[dict]:
        """Local: keyword search em NetworkX graph.json."""
        G = self._load_local_graph()
        terms = [t.lower() for t in query_text.split() if len(t) > 2]
        matches = [
            {
                "nid": nid,
                "label": d.get("label", ""),
                "source_file": d.get("source_file", ""),
                "degree": G.degree(nid),
            }
            for nid, d in G.nodes(data=True)
            if any(t in d.get("label", "").lower() for t in terms)
        ]
        return matches[:20]

    def _load_local_graph(self):
        import networkx as nx
        from networkx.readwrite import json_graph
        data = json.loads(Path(self.graph_json).read_text())
        return json_graph.node_link_graph(data, edges="links")

    def health_check(self) -> dict:
        try:
            self._connect()
            if self.mode == "local":
                return {
                    "status": "ok",
                    "backend": "local",
                    "tenant_id": self.tenant_id,
                    "user_id": self.user_id,
                    "scope": self.scope,
                    "path": self.graph_json,
                }
            with self._session() as session:
                result = session.run("RETURN 1 AS n")
                value = result.single()["n"]
            return {
                "status": "ok",
                "backend": self.mode,
                "tenant_id": self.tenant_id,
                "user_id": self.user_id,
                "scope": self.scope,
                "database": self.database,
                "url": self.url,
                "ping": str(value),
            }
        except Exception as e:
            return {
                "status": "error",
                "backend": self.mode,
                "tenant_id": self.tenant_id,
                "error": str(e),
            }

    def close(self):
        if self._driver is not None:
            self._driver.close()


def main():
    """CLI: backend selector + health check."""
    import argparse
    parser = argparse.ArgumentParser(
        description="Graphify backend manager (v3.8+, Neo4j multi-tenant + multi-user)"
    )
    parser.add_argument("--check", action="store_true", help="Health check")
    parser.add_argument("--mode", choices=["local", "neo4j-self-hosted", "neo4j-multi-tenant-user"],
                        help="Backend mode")
    parser.add_argument("--tenant-id", help="Tenant ID (empresa)")
    parser.add_argument("--user-id", help="User ID (individuo dentro do tenant)")
    parser.add_argument("--scope", choices=["tenant", "user"], help="Graph scope")
    parser.add_argument("--url", help="Neo4j Bolt URL")
    parser.add_argument("--admin", action="store_true", help="Admin access (system DB)")
    args = parser.parse_args()

    kwargs = {}
    if args.mode:
        kwargs["mode"] = args.mode
    if args.tenant_id is not None:
        kwargs["tenant_id"] = args.tenant_id
    if args.user_id is not None:
        kwargs["user_id"] = args.user_id
    if args.scope:
        kwargs["scope"] = args.scope
    if args.url:
        kwargs["url"] = args.url
    if args.admin:
        kwargs["admin"] = True

    backend = GraphBackend(**kwargs)
    print("[graphify-backend] mode=" + backend.mode +
          " tenant_id=" + str(backend.tenant_id) +
          " user_id=" + str(backend.user_id) +
          " scope=" + backend.scope +
          " database=" + backend.database)

    if args.check:
        result = backend.health_check()
        print("[health] " + str(result))
        sys.exit(0 if result["status"] == "ok" else 1)


if __name__ == "__main__":
    main()
