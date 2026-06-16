# NexusAI RAG MCP Design

## Goal

Build a standalone MCP server that Hermes Agent can use as the controlled gateway between NexusAI profiles and the future Supabase RAG database.

## Compatibility Target

Hermes Agent reads MCP servers from `~/.hermes/config.yaml` under `mcp_servers`. It supports local stdio servers and remote HTTP MCP servers. This project will target Streamable HTTP so the MCP can run beside Hermes in the same VPS Docker Compose stack without modifying Hermes core or installing the MCP runtime inside the Hermes container.

Hermes will register exposed tools as:

```text
mcp_nexusai_rag_<tool_name>
```

## Architecture

```text
Hermes Agent
  |
  | mcp_servers.nexusai_rag.url
  v
NexusAI RAG MCP HTTP server
  |
  | tenant policy, active context, audit
  v
Supabase Postgres + pgvector
```

The MCP owns all tenant checks before database access. Specialist profiles can query only `nexusai` plus the active client tenant. CEO/admin access is explicit and still audited.

## Runtime

- Node.js 22
- TypeScript
- Official MCP TypeScript SDK v1 package
- Streamable HTTP transport
- Supabase JS client
- YAML config
- Docker and Docker Compose

## Initial Tools

- `nexus_rag_search`
- `nexus_rag_set_active_client`
- `nexus_rag_context_status`
- `nexus_rag_list_sources`
- `nexus_rag_get_document`
- `nexus_rag_audit_recent`

`nexus_rag_ingest` is intentionally deferred. Ingestion needs document parsing, chunking, embeddings, and stricter write policy. The MVP should be read/search first.

## Tenant Policy

Default profile behavior:

```text
allowed_tenants = ["nexusai", active_client]
```

CEO/admin behavior:

```text
allowed_tenants = explicit requested tenant list, only when admin mode is enabled
```

Any requested tenant outside the allowed scope is denied before Supabase is queried.

## Configuration

Secrets live in `.env`.

Behavior and tenant policy live in YAML:

```yaml
server:
  host: "0.0.0.0"
  port: 8000

supabase:
  url_env: "SUPABASE_URL"
  service_role_key_env: "SUPABASE_SERVICE_ROLE_KEY"

policy:
  common_tenant: "nexusai"
  admin_profiles:
    - "ceo"
    - "default"
  default_limit: 8
  max_limit: 20
```

## Supabase Contract

The MVP expects the future database to expose tables and an RPC:

- `tenants`
- `documents`
- `document_chunks`
- `rag_queries`
- `rag_audit_events`
- `match_document_chunks`

If the database is not configured yet, the MCP should start and return clear tool errors instead of crashing at startup.

## Deployment Shape

The MCP is a standalone container:

```yaml
services:
  nexusai-rag-mcp:
    build: .
    env_file: .env
    volumes:
      - ./config:/app/config:ro
    ports:
      - "8000:8000"
```

Hermes config in the same compose network:

```yaml
mcp_servers:
  nexusai_rag:
    url: "http://nexusai-rag-mcp:8000/mcp"
    timeout: 60
    tools:
      include:
        - nexus_rag_search
        - nexus_rag_set_active_client
        - nexus_rag_context_status
        - nexus_rag_list_sources
        - nexus_rag_get_document
        - nexus_rag_audit_recent
      prompts: false
      resources: false
```

