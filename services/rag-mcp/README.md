# NexusAI RAG MCP

Hermes-compatible MCP server for the future NexusAI multi-tenant Supabase RAG base.

This project keeps Hermes Agent clean: Hermes connects to this server over MCP HTTP, and this server owns tenant policy, active-client context, Supabase access, and audit logging.

## Why HTTP MCP

Hermes supports MCP servers in `~/.hermes/config.yaml` through `mcp_servers`. HTTP is the best fit for the planned VPS setup because Hermes can run in one container and this MCP can run beside it in the same compose network.

## Tools

- `nexus_rag_search`
- `nexus_rag_set_active_client`
- `nexus_rag_context_status`
- `nexus_rag_list_sources`
- `nexus_rag_get_document`
- `nexus_rag_get_ens_course_context`
- `nexus_rag_ingest_source`
- `nexus_rag_audit_recent`

`nexus_rag_ingest_source` supports controlled refresh ingestion for `ens_courses` and `nexusai_manual`.

## Local Setup

```bash
npm install
cp .env.example .env
npm run build
npm start
```

Health check:

```bash
curl http://localhost:8000/health
```

## Config

Behavior lives in `config/nexusai-rag-mcp.yaml`.

Secrets live in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ENS_API_URL=...
ENS_API_KEY=...
ENS_API_KEY_HEADER=key
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

If Supabase env vars are missing, the server still starts. RAG tools return a clear unavailable error until the database is configured.

## Hermes Config

When this MCP runs in the same Docker Compose network as Hermes:

```yaml
mcp_servers:
  nexusai_rag:
    url: "http://nexusai-rag-mcp:8000/mcp"
    timeout: 60
    connect_timeout: 15
    supports_parallel_tool_calls: false
    tools:
      include:
        - nexus_rag_search
        - nexus_rag_set_active_client
        - nexus_rag_context_status
        - nexus_rag_list_sources
        - nexus_rag_get_document
        - nexus_rag_get_ens_course_context
        - nexus_rag_ingest_source
        - nexus_rag_audit_recent
      prompts: false
      resources: false
```

Hermes will expose the tools with its MCP prefix, for example:

```text
mcp_nexusai_rag_nexus_rag_search
```

## Supabase

Apply `supabase/schema.sql` after creating the Supabase project.

If you already applied the first schema, apply `supabase/migrations/2026-06-10-rag-ingestion.sql` next.

Search uses full-text search when embeddings are unavailable and hybrid vector + full-text search when `OPENAI_API_KEY` is configured and chunks have embeddings.

## Ingestion

Run controlled ingestion through the MCP tool:

```json
{
  "source_id": "ens_courses",
  "tenant_id": "ens",
  "actor_profile": "ceo",
  "admin_mode": true
}
```

ENS ingestion is specific to tenant `ens`. Its dead-course rule is not global:

```text
skip only when liberar_curso = blocked and exibir_sempre_pagina_interna = false
```

For Hermes copy/strategy work on ENS courses, use the ENS-only context expansion tool after setting the active client:

```json
{
  "course_name": "Gestão de Seguros",
  "actor_profile": "marketing-specialist",
  "client_id": "ens"
}
```

This returns all ingested chunks for the selected ENS course grouped by section: summary, description, audience, modules, faculty, offers, visual content, FAQs, differentials, and testimonials when present.

NexusAI example ingestion:

```json
{
  "source_id": "nexusai_manual",
  "tenant_id": "nexusai",
  "actor_profile": "ceo",
  "admin_mode": true
}
```

The current NexusAI source uses example content from `data/seeds/nexusai-example-content.json`.

## Tenant Rule

Specialist profiles can access:

```text
nexusai + active_client
```

Admin profiles listed in YAML can access other tenants only with `admin_mode: true` and explicit tenant IDs.
