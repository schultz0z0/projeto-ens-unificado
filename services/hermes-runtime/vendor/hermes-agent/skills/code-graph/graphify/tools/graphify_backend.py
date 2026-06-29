"""graphify_backend.py - Backend Neo4j multi-tenant pra white-label Nexus.

v3.7+: Padronizado em Neo4j (substituiu FalkorDB por requisito do projeto).
Suporta 3 modos (mas Neo4j eh o padrao):
- local: graph.json local (NetworkX, sem servidor) - DEV ONLY
- neo4j-self-hosted: 1 Neo4j multi-database, sem isolamento forte
- neo4j-multi-tenant: 1 Neo4j, 1 database por tenant_id (DEFAULT PRODUCAO)

Multi-tenant:
- Cada request traz tenant_id (via JWT ou env)
- Backend resolve database automaticamente: "nexus_tenant_<id>"
- USE DATABASE comitado antes de query

USO:
    from graphify_backend import GraphBackend

    # Auto-detect (env vars: NEXUS_GRAPH_BACKEND, NEXUS_TENANT_ID)
    backend = GraphBackend()

    # Multi-tenant (saas)
    backend_t = GraphBackend(tenant_id="acme")

    # Query
    backend.query("MATCH (n:Module) RETURN n LIMIT 10")
"""

from __future__ import annotations
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Literal

BackendMode = Literal["local", "neo4j-self-hosted", "neo4j-multi-tenant"]
TENANT_ID_PATTERN = re.compile(r"^[a-z0-9_-]{3,64}$")


def detect_backend_mode() -> BackendMode:
    """Detecta backend via NEXUS_GRAPH_BACKEND env var."""
    env = os.environ.get("NEXUS_GRAPH_BACKEND", "neo4j-multi-tenant").lower()
    valid = ("local", "neo4j-self-hosted", "neo4j-multi-tenant")
    if env not in valid:
        sys.stderr.write(
            "[graphify-backend] WARN: NEXUS_GRAPH_BACKEND=" + env + " invalido (esperado " + str(valid) + "), usando neo4j-multi-tenant\n"
        )
        return "neo4j-multi-tenant"
    return env  # type: ignore[return-value]


def detect_tenant_id() -> str | None:
    """Detecta tenant_id via env var ou None (apenas self-hosted)."""
    tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if tenant_id and not TENANT_ID_PATTERN.match(tenant_id):
        sys.stderr.write(
            "[graphify-backend] WARN: NEXUS_TENANT_ID=" + tenant_id + " invalido (esperado [a-z0-9_-]{3,64})\n"
        )
        return None
    return tenant_id


def tenant_database_name(tenant_id: str | None) -> str:
    """Resolve database name a partir do tenant_id.

    None tenant = use 'neo4j' (admin database, compartilhado)
    Tenant 'acme' = 'nexus_tenant_acme'
    """
    if tenant_id is None:
        return "neo4j"
    # Sanitizar (apesar do regex ja garantir)
    safe = re.sub(r"[^a-z0-9_-]", "", tenant_id.lower())[:63]
    return "nexus_tenant_" + safe


class GraphBackend:
    """Backend Neo4j multi-tenant (v3.7+ white-label padrao)."""

    def __init__(
        self,
        mode: BackendMode | None = None,
        url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        tenant_id: str | None = None,
        graph_json: str | None = None,
        admin: bool = False,
    ):
        """
        Args:
            mode: 'local' (DEV), 'neo4j-self-hosted' (1 DB compartilhada),
                  'neo4j-multi-tenant' (DEFAULT, 1 DB por tenant_id)
            url: Neo4j Bolt URL (default: bolt://neo4j:7687)
            username: Neo4j user (default: neo4j)
            password: Neo4j password (default: NEXUS_NEO4J_PASSWORD env)
            tenant_id: Para modos multi-tenant, identifica o tenant.
                       None = admin access (sem isolamento)
            graph_json: Path do graph.json (apenas mode='local')
            admin: Se True, conecta com privileges admin (CREATE DATABASE etc)
        """
        self.mode = mode or detect_backend_mode()
        self.tenant_id = tenant_id if tenant_id is not None else detect_tenant_id()
        self.url = url or os.environ.get("NEXUS_GRAPH_URL", "bolt://neo4j:7687")
        self.username = username or os.environ.get("NEXUS_NEO4J_USER", "neo4j")
        self.password = password or os.environ.get("NEXUS_NEO4J_PASSWORD", "neo4j")
        self.graph_json = graph_json or os.environ.get(
            "NEXUS_GRAPH_JSON", "/opt/data/graphify-out/graph.json"
        )
        self.admin = admin
        self.database = tenant_database_name(self.tenant_id) if self.mode == "neo4j-multi-tenant" else "neo4j"
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
            raise RuntimeError(
                "neo4j nao instalado. Use: pip install graphifyy[all]"
            ) from e
        self._driver = GraphDatabase.driver(
            self.url,
            auth=(self.username, self.password),
        )
        self._connected = True

    def _session(self):
        self._connect()
        # Usar 'neo4j' database pra operacoes admin (CREATE DATABASE, etc)
        db = "neo4j" if self.admin else self.database
        return self._driver.session(database=db)

    def query(self, cypher: str, params: dict | None = None) -> list[dict]:
        """Query Cypher scoped per-tenant (modo multi-tenant) ou `neo4j` system db.

        Args:
            cypher: Cypher query string
            params: Optional query parameters

        Returns:
            List of dict records
        """
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
        """Verifica saude do backend."""
        try:
            self._connect()
            if self.mode == "local":
                return {
                    "status": "ok",
                    "backend": "local",
                    "tenant_id": None,
                    "path": self.graph_json,
                }
            with self._session() as session:
                result = session.run("RETURN 1 AS n")
                value = result.single()["n"]
            return {
                "status": "ok",
                "backend": self.mode,
                "tenant_id": self.tenant_id,
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
    """CLI: backend selector + health check + admin de tenant."""
    import argparse
    parser = argparse.ArgumentParser(description="Graphify backend manager (v3.7+, Neo4j multi-tenant)")
    parser.add_argument("--check", action="store_true", help="Health check")
    parser.add_argument("--mode", choices=["local", "neo4j-self-hosted", "neo4j-multi-tenant"],
                        help="Backend mode")
    parser.add_argument("--tenant-id", help="Tenant ID (multi-tenant mode)")
    parser.add_argument("--url", help="Neo4j Bolt URL")
    parser.add_argument("--admin", action="store_true", help="Admin access (CREATE DATABASE etc)")
    args = parser.parse_args()

    kwargs = {}
    if args.mode:
        kwargs["mode"] = args.mode
    if args.tenant_id is not None:
        kwargs["tenant_id"] = args.tenant_id
    if args.url:
        kwargs["url"] = args.url
    if args.admin:
        kwargs["admin"] = True

    backend = GraphBackend(**kwargs)
    print("[graphify-backend] mode=" + backend.mode +
          " tenant_id=" + str(backend.tenant_id) +
          " database=" + backend.database +
          " url=" + backend.url)

    if args.check:
        result = backend.health_check()
        print("[health] " + str(result))
        sys.exit(0 if result["status"] == "ok" else 1)


if __name__ == "__main__":
    main()
