# ENS RAG MCP

Hermes-compatible MCP server for the ENS knowledge base.

This project keeps Hermes clean: Hermes connects over MCP HTTP, and this server owns Supabase access, collection routing, ingestion, audit logging, and write guardrails.

## Collections

- `courses`: ENS course catalog, offers, links, modules, FAQs, faculty, and course facts. Read-only for Hermes.
- `insights`: reusable dated ENS analysis such as funnels, campaigns, and performance conclusions.
- `institutional`: institutional ENS knowledge and reference context. Read-only in this version.
- `marketing`: validated ENS marketing learnings and approved campaign knowledge.

## Tools

New ENS-first tools:

- `ens_rag_search`
- `ens_rag_get_document`
- `ens_rag_get_course_context`
- `ens_rag_ingest_courses`
- `ens_rag_ingest_institutional`
- `ens_rag_ingest_marketing`
- `ens_rag_ingest_insights`
- `ens_rag_save_insight`
- `ens_rag_save_marketing_memory`
- `ens_rag_list_collections`
- `ens_rag_audit_recent`

The MCP exposes only ENS-first tools. Previous multi-tenant tool names are intentionally not registered.

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

Behavior lives in `config/ens-rag-mcp.yaml`.

Secrets live in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ENS_API_URL=...
ENS_API_KEY=...
ENS_API_KEY_HEADER=x-api-key
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ENS_INSTITUTIONAL_CONTENT_DIR=data/institutional
ENS_MARKETING_CONTENT_DIR=data/marketing
ENS_INSIGHTS_CONTENT_DIR=data/insights
```

If Supabase env vars are missing, the server still starts. RAG tools return a clear unavailable error until the database is configured.

## Supabase

For a fresh ENS RAG project:

```text
apply services/rag-mcp/supabase/schema.sql
```

For an existing project already running the old MCP:

1. ensure `services/rag-mcp/supabase/migrations/2026-06-10-rag-ingestion.sql` is already applied
2. apply `services/rag-mcp/supabase/migrations/2026-06-16-ens-rag-collections.sql`
3. apply `services/rag-mcp/supabase/migrations/2026-06-16-remove-nexusai-tenant.sql` to remove old NexusAI rows
4. apply `services/rag-mcp/supabase/migrations/2026-06-17-ens-course-advanced-search.sql`

Search uses full-text search when embeddings are unavailable and hybrid vector + full-text search when `OPENAI_API_KEY` is configured and chunks have embeddings.

The 2026-06-17 migration adds the advanced RPC used for course filters and ranking. The MCP has a fallback to the old RPC, but course search quality is lower until this migration is applied.

## Ingestion

Course ingestion is now ENS-only and collection-specific.

The Markdown knowledge under `services/rag-mcp/data` is intentionally versioned. Do not treat it like runtime volume data; it must be present in a fresh Git clone so the Docker image can ingest institutional, marketing, and insights knowledge.

Run controlled ingestion through the MCP tool:

```json
{
  "actor_profile": "ceo",
  "admin_mode": true
}
```

Tool name:

```text
ens_rag_ingest_courses
```

ENS course filter:

```text
skip only when liberar_curso = blocked and exibir_sempre_pagina_interna = false
```

The refresh model remains replace-then-add for the ENS course source.

After changes to the ENS course normalizer or after applying the advanced course search migration, run `ens_rag_ingest_courses` again. This recreates course chunks with one `course_offer` chunk per offer and filterable metadata such as `course_category`, `course_type`, `offer_status`, `offer_modality`, `offer_location`, `offer_start_date` and enrollment dates.

Institutional ingestion uses versioned Markdown files from:

```text
data/institutional
```

Tool name:

```text
ens_rag_ingest_institutional
```

Marketing ingestion uses versioned Markdown files from:

```text
data/marketing
```

Tool name:

```text
ens_rag_ingest_marketing
```

Insights ingestion uses versioned Markdown files from:

```text
data/insights
```

Tool name:

```text
ens_rag_ingest_insights
```

The helper script calls all four ingestion tools through MCP:

```bash
MCP_URL=http://127.0.0.1:8000/mcp node scripts/run-first-ingestion.mjs
```

The ingestion order is:

1. `ens_rag_ingest_courses` from the ENS site API.
2. `ens_rag_ingest_institutional` from `data/institutional`.
3. `ens_rag_ingest_marketing` from `data/marketing`.
4. `ens_rag_ingest_insights` from `data/insights`.

In production Compose, `rag-mcp-ingestion-cron` runs the same script automatically once a week by default:

```env
NEXUS_TZ=America/Sao_Paulo
NEXUS_RAG_INGEST_ACTOR_PROFILE=ceo
NEXUS_RAG_INGEST_CRON_SCHEDULE=0 7 * * 1
```

That schedule means every Monday at 07:00 in `NEXUS_TZ`. The cron also runs `scripts/validate-ens-rag.mjs` after ingestion.

The local Markdown RAGs are versioned inside the repo/image. If you update files under `services/rag-mcp/data`, rebuild/recreate the `rag-mcp` image so the cron container can see the updated files.

After ingestion, validate collection counts and one grounded search per collection:

```bash
MCP_URL=http://127.0.0.1:8000/mcp node scripts/validate-ens-rag.mjs
```

Arguments:

```json
{
  "actor_profile": "ceo",
  "admin_mode": true
}
```

## Search and Save Rules

- Use `courses` for factual course grounding.
- Use `ens_rag_get_course_context` for one specific course.
- For course offers, links, dates, investment, modality or enrollment, use `course_filters.chunk_kinds: ["course_offer"]` and usually `only_active_offers: true`.
- Use `insights` for analytical memory and prefer recent analysis.
- Use `institutional` for ENS institutional context.
- Use `marketing` only for validated marketing memory.
- `ens_rag_save_marketing_memory` requires explicit user validation.
- Use `ens_rag_search` with explicit `collections` whenever the task is narrow.
- Treat empty search results as lack of grounded evidence, not permission to invent.

## Skills

The installable skill for Hermes is stored inside this repo:

- `skills/ens-rag`

It is not auto-installed. Validate it first, then install or copy it into Hermes manually.

## Hermes Config Example

See `docs/hermes-config.example.yaml`.

This repo does not modify Hermes automatically.
