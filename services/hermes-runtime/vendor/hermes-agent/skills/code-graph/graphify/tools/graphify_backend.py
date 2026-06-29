"""graphify_backend.py - Backend unificado pra knowledge graph.

Suporta 3 modos (v3.6+ white-label Nexus):
- local: graph.json local (NetworkX, sem servidor externo) - DEFAULT
- falkordb: FalkorDB self-hosted (Redis-compatible, MIT license)
- neo4j: Neo4j (GPLv3, requer Enterprise se for distribuir)

USO:
    from graphify_backend import GraphBackend
    
    backend = GraphBackend()
    backend.load_graph(json_path)
    backend.query("MATCH (n:Module) RETURN n LIMIT 10")
    backend.health_check()
"""

from __future__ import annotations
import json
import os
import sys
from pathlib import Path
from typing import Any, Literal

BackendMode = Literal["local", "falkordb", "neo4j"]


def detect_backend_mode() -> BackendMode:
    """Detecta backend via NEXUS_GRAPH_BACKEND env var. Default: local."""
    env = os.environ.get("NEXUS_GRAPH_BACKEND", "local").lower()
    if env not in ("local", "falkordb", "neo4j"):
        sys.stderr.write(
            "[graphify-backend] WARN: NEXUS_GRAPH_BACKEND=" + env + " invalido, usando local\n"
        )
        return "local"
    return env


class GraphBackend:
    """Backend unificado pra knowledge graph do Graphify."""

    def __init__(
        self,
        mode=None,
        url=None,
        db=None,
        graph_json=None,
    ):
        self.mode = mode or detect_backend_mode()
        self.url = url or os.environ.get(
            "NEXUS_GRAPH_URL",
            "redis://falkordb:6379" if self.mode == "falkordb" else "bolt://neo4j:7687"
        )
        self.db = db or os.environ.get("NEXUS_GRAPH_DB", "nexus")
        self.graph_json = graph_json or os.environ.get(
            "NEXUS_GRAPH_JSON", "/opt/data/graphify-out/graph.json"
        )
        self._client = None
        self._connected = False

    def _connect(self):
        if self._connected:
            return
        if self.mode == "local":
            self._connected = True
            return
        if self.mode == "falkordb":
            try:
                import falkordb
                self._client = falkordb.FalkorDB(host=self.url, port=self.parse_port())
                self._client.select(self.db)
                self._connected = True
            except ImportError as e:
                raise RuntimeError(
                    "falkordb nao instalado. "
                    "Use: pip install graphifyy[all]"
                ) from e
        elif self.mode == "neo4j":
            try:
                from neo4j import GraphDatabase
                self._client = GraphDatabase.driver(
                    self.url,
                    auth=("neo4j", os.environ.get("NEXUS_NEO4J_PASSWORD", "neo4j"))
                )
                self._connected = True
            except ImportError as e:
                raise RuntimeError(
                    "neo4j nao instalado. "
                    "Use: pip install graphifyy[all]"
                ) from e

    def parse_port(self) -> int:
        try:
            return int(self.url.split(":")[-1].split("/")[0])
        except (ValueError, IndexError):
            return 6379 if self.mode == "falkordb" else 7687

    def load_graph(self, graph_path=None):
        self._connect()
        path = graph_path or self.graph_json
        if self.mode == "local":
            import networkx as nx
            from networkx.readwrite import json_graph
            data = json.loads(Path(path).read_text())
            return json_graph.node_link_graph(data, edges="links")
        return self._client

    def query(self, cypher_or_search, params=None):
        self._connect()
        if self.mode == "falkordb":
            graph = self._client.query(cypher_or_search, params or {})
            return graph.result_set
        if self.mode == "neo4j":
            with self._client.session() as session:
                result = session.run(cypher_or_search, params or {})
                return [dict(record) for record in result]
        # Local: keyword search em NetworkX
        G = self.load_graph()
        terms = [t.lower() for t in cypher_or_search.split() if len(t) > 2]
        matches = [
            (nid, d.get("label", ""))
            for nid, d in G.nodes(data=True)
            if any(t in d.get("label", "").lower() for t in terms)
        ]
        return matches[:20]

    def health_check(self):
        try:
            self._connect()
            if self.mode == "local":
                return {"status": "ok", "backend": "local", "path": self.graph_json}
            if self.mode == "falkordb":
                self._client.ping()
                return {"status": "ok", "backend": "falkordb", "db": self.db}
            if self.mode == "neo4j":
                with self._client.session() as s:
                    s.run("RETURN 1")
                return {"status": "ok", "backend": "neo4j", "db": self.db}
        except Exception as e:
            return {"status": "error", "backend": self.mode, "error": str(e)}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Graphify backend manager")
    parser.add_argument("--check", action="store_true", help="Health check")
    parser.add_argument("--mode", choices=["local", "falkordb", "neo4j"], help="Backend mode")
    parser.add_argument("--url", help="Server URL")
    parser.add_argument("--db", help="Database name")
    args = parser.parse_args()

    kwargs = {}
    if args.mode:
        kwargs["mode"] = args.mode
    if args.url:
        kwargs["url"] = args.url
    if args.db:
        kwargs["db"] = args.db

    backend = GraphBackend(**kwargs)
    print("[graphify-backend] mode=" + backend.mode + " url=" + backend.url + " db=" + backend.db)

    if args.check:
        result = backend.health_check()
        print("[health] " + str(result))
        sys.exit(0 if result["status"] == "ok" else 1)


if __name__ == "__main__":
    main()
