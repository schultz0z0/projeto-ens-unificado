"""graphify_api_server.py - Standalone server para testes / demo local.

Uso:
  python graphify_api_server.py
  curl -H "X-Tenant-Id: acme" http://localhost:8653/stats

Para deploy em producao, copiar o router pro hermes-api:
  from graphify_api import graphify_router
  app.include_router(graphify_router, prefix="/api/graph")
"""

from fastapi import FastAPI
from graphify_api import router

app = FastAPI(
    title="Nexus Graph API",
    description="Multi-tenant knowledge graph endpoints for white-label Nexus",
    version="3.7.0",
)
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8653, log_level="info")
