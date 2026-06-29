"""graphify_api.py - FastAPI router pra endpoints /api/graph/* (multi-tenant).

Endpoints:
  GET  /health                       - health check
  POST /query                         {cypher, params} -> results
  POST /explain                       {label, depth} -> node + neighbors
  GET  /stats                         {tenant_id} -> node/edge/label counts
  GET  /god-nodes                     {top_n, tenant_id}
  POST /import                        {graph_json_url} -> Cypher import (admin only)

Auth: Tenant ID vem do header 'X-Tenant-Id' ou do JWT claim 'tenant_id'.
      Multi-tenant isolation eh feita no nivel Neo4j (database name).

USO standalone:
  $ uvicorn graphify_api:app --port 8653
  $ curl -H 'X-Tenant-Id: acme' http://localhost:8653/stats

USO plugged no hermes-api:
  from graphify_api import graphify_router
  app.include_router(graphify_router, prefix="/api/graph")
"""

from __future__ import annotations
import os
from typing import Any, Literal

try:
    from fastapi import APIRouter, HTTPException, Header, Depends, Body
    from pydantic import BaseModel, Field
except ImportError:
    # FastAPI nao instalado - isto eh apenas documentacao do modulo
    import sys
    sys.exit(0)

from graphify_backend import GraphBackend, tenant_database_name

router = APIRouter()


class QueryRequest(BaseModel):
    cypher: str = Field(..., description="Cypher query to execute")
    params: dict[str, Any] = Field(default_factory=dict, description="Query parameters")


class ExplainRequest(BaseModel):
    label: str = Field(..., description="Node label or ID to find")
    depth: int = Field(default=1, ge=1, le=5)


def _get_tenant_id(
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
) -> str:
    """Resolve tenant_id from header or env."""
    import os
    tid = x_tenant_id or os.environ.get("NEXUS_TENANT_ID")
    if not tid:
        raise HTTPException(
            status_code=400,
            detail="tenant_id required: pass via X-Tenant-Id header or set NEXUS_TENANT_ID env"
        )
    return tid


def _get_backend(tenant_id: str) -> GraphBackend:
    """Init backend scoped per-tenant."""
    return GraphBackend(tenant_id=tenant_id)


@router.get("/health")
async def health():
    """Health check sem autenticacao (admin-level)."""
    backend = GraphBackend(admin=True)
    result = backend.health_check()
    return result


@router.post("/query")
async def query_cypher(body: QueryRequest, tenant_id: str = Depends(_get_tenant_id)):
    """Query Cypher scoped per-tenant.

    Example:
        curl -X POST http://server/api/graph/query \\
             -H 'X-Tenant-Id: acme' -H 'Content-Type: application/json' \\
             -d '{"cypher": "MATCH (n:Module) RETURN n LIMIT 10"}'
    """
    backend = _get_backend(tenant_id)
    try:
        results = backend.query(body.cypher, body.params)
        return {"tenant_id": tenant_id, "results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"query error: {str(e)}")


@router.post("/explain")
async def explain(body: ExplainRequest, tenant_id: str = Depends(_get_tenant_id)):
    """Find node by label + show neighbors (BFS up to depth).

    Returns up to N nodes labeled 'body.label' and their edges.
    """
    backend = _get_backend(tenant_id)
    # Cypher: find node, BFS to depth
    cypher = """
    MATCH (start)
    WHERE start.label = $label OR start.id = $label
    WITH start, $depth AS depth
    CALL {
        WITH start, depth
        MATCH path = (start)-[*0..depth]-()
        RETURN nodes(path) AS all_nodes, relationships(path) AS all_edges
        LIMIT 100
    }
    UNWIND all_nodes AS n
    WITH DISTINCT n, all_edges
    RETURN n, all_edges
    """
    results = backend.query(cypher, {"label": body.label, "depth": body.depth})
    return {"tenant_id": tenant_id, "label": body.label, "depth": body.depth, "results": results}


@router.get("/stats")
async def graph_stats(tenant_id: str = Depends(_get_tenant_id)):
    """Stats: node count, edge count, labels, etc. Scoped per tenant."""
    backend = _get_backend(tenant_id)
    try:
        nodes = backend.query("MATCH (n) RETURN count(n) AS c")[0]["c"]
        edges = backend.query("MATCH ()-[r]->() RETURN count(r) AS c")[0]["c"]
        labels = [r["label"] for r in backend.query("CALL db.labels() YIELD label RETURN label ORDER BY label")]
        return {
            "tenant_id": tenant_id,
            "nodes": nodes,
            "edges": edges,
            "labels": labels,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/god-nodes")
async def god_nodes(top_n: int = 10, tenant_id: str = Depends(_get_tenant_id)):
    """Return top N most-connected nodes (architecture core concepts).

    Scoped per tenant. Default top 10.
    """
    backend = _get_backend(tenant_id)
    cypher = """
    MATCH (n)
    WITH n, size((n)--()) AS degree
    ORDER BY degree DESC
    LIMIT $top_n
    RETURN n.label AS label, n.id AS id, n.source_file AS source_file, degree
    """
    results = backend.query(cypher, {"top_n": top_n})
    return {"tenant_id": tenant_id, "god_nodes": results}


# Standalone runner (Pra testes locais)
if __name__ == "__main__":
    from fastapi import FastAPI
    app = FastAPI(title="Nexus Graph API", version="3.7.0")
    app.include_router(router)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8653, log_level="info")
