"""memory_api.py - FastAPI router pra /api/memory/* (v3.8+ multi-user).

Endpoints (todos requerem X-Tenant-Id, X-User-Id opcional):

  GET    /api/memory/global         - le memoria compartilhada do tenant
  POST   /api/memory/global         - escreve/atualiza memoria compartilhada
  GET    /api/memory/user           - le memoria privada do user (requer user_id)
  POST   /api/memory/user           - escreve memoria privada do user
  DELETE /api/memory/user           - deleta memoria privada do user (irreversivel)
  GET    /api/memory/all            - le ambas (global + user merged)
  GET    /api/memory/stats          - stats de uso (bytes, paths)

Resolve tenant_id do header X-Tenant-Id ou env NEXUS_TENANT_ID.
Resolve user_id do header X-User-Id ou env NEXUS_USER_ID.

Uso standalone:
  $ uvicorn memory_api:router --port 8654
  $ curl -H 'X-Tenant-Id: acme' -H 'X-User-Id: alice' http://localhost:8654/api/memory/user

Uso plugged no hermes-api:
  from memory_api import router as memory_router
  app.include_router(memory_router, prefix="/api/memory")
"""

from __future__ import annotations
import os
import sys
from typing import Any, Literal, Optional

try:
    from fastapi import APIRouter, HTTPException, Header, Body
    from pydantic import BaseModel, Field
except ImportError:
    import sys
    sys.exit(0)

from memory_store import MemoryStore, MemoryStoreError

router = APIRouter()


# ============== Schemas ==============

class MemoryWrite(BaseModel):
    content: str = Field(..., description="Markdown content")
    merge: bool = Field(default=False, description="Append with timestamp instead of overwrite")


class MemoryResponse(BaseModel):
    tenant_id: str
    user_id: Optional[str] = None
    scope: Literal["global", "user"]
    content: Optional[str] = None
    bytes: int = 0


class AllMemoryResponse(BaseModel):
    tenant_id: str
    user_id: Optional[str] = None
    global_content: Optional[str] = None
    user_content: Optional[str] = None


# ============== Helpers ==============

def _get_tenant_and_user(
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> tuple[str, str | None]:
    """Resolve tenant_id e user_id via header ou env."""
    tenant_id = x_tenant_id or os.environ.get("NEXUS_TENANT_ID")
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="tenant_id required: pass via X-Tenant-Id header or set NEXUS_TENANT_ID env"
        )
    user_id = x_user_id or os.environ.get("NEXUS_USER_ID")
    return tenant_id, user_id


def _make_store(tenant_id: str, user_id: str | None) -> MemoryStore:
    """Cria MemoryStore. user_id eh opcional (global-only)."""
    try:
        return MemoryStore(tenant_id=tenant_id, user_id=user_id)
    except MemoryStoreError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Endpoints ==============

@router.get("/global", response_model=MemoryResponse)
async def read_global(
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
) -> MemoryResponse:
    """Le memoria compartilhada do tenant (todos os users)."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header required")
    store = _make_store(tenant_id, None)
    content = store.read_global()
    return MemoryResponse(
        tenant_id=tenant_id,
        scope="global",
        content=content,
        bytes=len(content) if content else 0,
    )


@router.post("/global")
async def write_global(
    body: MemoryWrite,
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
) -> dict:
    """Escreve memoria compartilhada do tenant."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header required")
    store = _make_store(tenant_id, None)
    try:
        msg = store.write_global(body.content, merge=body.merge)
        return {"status": "ok", "message": msg, "bytes": len(body.content)}
    except MemoryStoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user", response_model=MemoryResponse)
async def read_user(
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
    user_id: str = Header(default=None, alias="X-User-Id"),
) -> MemoryResponse:
    """Le memoria PRIVADA do user (requer X-User-Id)."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not user_id:
        user_id = os.environ.get("NEXUS_USER_ID")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header required")
    if not user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required for /user endpoint")
    store = _make_store(tenant_id, user_id)
    content = store.read_user()
    return MemoryResponse(
        tenant_id=tenant_id,
        user_id=user_id,
        scope="user",
        content=content,
        bytes=len(content) if content else 0,
    )


@router.post("/user")
async def write_user(
    body: MemoryWrite,
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
    user_id: str = Header(default=None, alias="X-User-Id"),
) -> dict:
    """Escreve memoria PRIVADA do user."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not user_id:
        user_id = os.environ.get("NEXUS_USER_ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    store = _make_store(tenant_id, user_id)
    try:
        msg = store.write_user(body.content, merge=body.merge)
        return {
            "status": "ok",
            "tenant_id": tenant_id,
            "user_id": user_id,
            "message": msg,
            "bytes": len(body.content),
        }
    except MemoryStoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user")
async def delete_user(
    confirm: str = "no",
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
    user_id: str = Header(default=None, alias="X-User-Id"),
) -> dict:
    """Deleta memoria PRIVADA do user (irreversivel). Requer confirm=DELETE."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not user_id:
        user_id = os.environ.get("NEXUS_USER_ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    if confirm != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Deletion requires ?confirm=DELETE query param"
        )
    store = _make_store(tenant_id, user_id)
    deleted = store.delete_user(confirm=confirm)
    return {"status": "ok" if deleted else "noop", "tenant_id": tenant_id, "user_id": user_id}


@router.get("/all", response_model=AllMemoryResponse)
async def read_all(
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
    user_id: str = Header(default=None, alias="X-User-Id"),
) -> AllMemoryResponse:
    """Le global + user merged. Retorna ambos os escopos."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header required")
    if not user_id:
        user_id = os.environ.get("NEXUS_USER_ID")
    store = _make_store(tenant_id, user_id)
    return AllMemoryResponse(
        tenant_id=tenant_id,
        user_id=user_id,
        global_content=store.read_global(),
        user_content=store.read_user() if user_id else None,
    )


@router.get("/stats")
async def stats(
    tenant_id: str = Header(default=None, alias="X-Tenant-Id"),
    user_id: str = Header(default=None, alias="X-User-Id"),
) -> dict:
    """Stats de uso: bytes globais, bytes privados, paths."""
    if not tenant_id:
        tenant_id = os.environ.get("NEXUS_TENANT_ID")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header required")
    if not user_id:
        user_id = os.environ.get("NEXUS_USER_ID")
    store = _make_store(tenant_id, user_id)
    return store.stats()


# Standalone runner
if __name__ == "__main__":
    from fastapi import FastAPI
    from memory_api import router as memory_router
    
    app = FastAPI(title="Nexus Memory API", version="3.8.0")
    app.include_router(memory_router)
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8654, log_level="info")
