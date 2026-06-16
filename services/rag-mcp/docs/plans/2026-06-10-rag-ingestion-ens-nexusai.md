# RAG Ingestion ENS and NexusAI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a complete RAG ingestion path for the ENS client API and a manual example-content ingestion path for NexusAI.

**Architecture:** The MCP gets a source-specific ingestion layer. ENS has its own connector, normalizer, and filtering rule; NexusAI has a manual JSON seed source. A shared ingestion service refreshes Supabase documents/chunks for one source, generates embeddings, and records audit/query metadata.

**Tech Stack:** TypeScript, Vitest, MCP TypeScript SDK, Supabase JS, OpenAI-compatible embeddings over `fetch`, YAML config, Supabase SQL migrations.

---

### Task 1: ENS Normalizer TDD

**Files:**
- Create: `src/ingestion/sources/ens/ensCourseNormalizer.test.ts`
- Create: `src/ingestion/sources/ens/ensCourseNormalizer.ts`

**Steps:**
1. Write tests for the ENS-only dead-course rule.
2. Write tests that blocked courses with `exibir_sempre_pagina_interna=true` are included.
3. Write tests that empty/null fields do not generate noisy chunks.
4. Run the test and verify it fails before implementation.
5. Implement the normalizer and verify tests pass.

### Task 2: Shared Ingestion Types and Chunking

**Files:**
- Create: `src/ingestion/types.ts`
- Create: `src/ingestion/text.ts`

**Steps:**
1. Define `IngestionDocument`, `IngestionChunk`, and `IngestionSource`.
2. Add helpers for clean text blocks and stable source keys.

### Task 3: Sources

**Files:**
- Create: `src/ingestion/sources/ens/ensCoursesSource.ts`
- Create: `src/ingestion/sources/nexusai/nexusaiManualSource.ts`
- Create: `data/seeds/nexusai-example-content.json`

**Steps:**
1. Implement ENS fetch using `ENS_API_URL`, `ENS_API_KEY`, and `ENS_API_KEY_HEADER`.
2. Implement NexusAI manual example content from a local JSON seed.

### Task 4: Embeddings

**Files:**
- Create: `src/ingestion/embeddings/embeddingProvider.ts`

**Steps:**
1. Implement a disabled provider that returns `null` when no API key is configured.
2. Implement OpenAI-compatible embeddings with `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, and `OPENAI_EMBEDDING_BASE_URL`.

### Task 5: Supabase Refresh

**Files:**
- Modify: `src/rag/types.ts`
- Modify: `src/rag/ragRepository.ts`
- Create: `supabase/migrations/2026-06-10-rag-ingestion.sql`
- Modify: `supabase/schema.sql`

**Steps:**
1. Add repository methods to ensure tenants, refresh source documents, and insert chunks.
2. Add schema fields `source_id`, `source_key`, `ingestion_run_id`, and `embedding_model`.
3. Add a hybrid search RPC that combines vector distance and FTS when an embedding is supplied.

### Task 6: MCP Tool

**Files:**
- Modify: `src/mcp/createServer.ts`

**Steps:**
1. Register `nexus_rag_ingest_source`.
2. Permit ENS ingestion only into tenant `ens`.
3. Permit NexusAI manual example ingestion only into tenant `nexusai`.
4. Return source counts, skipped courses, documents, chunks, and embedding status.

### Task 7: Docs and Verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/hermes-config.example.yaml`

**Steps:**
1. Document ENS env vars and embedding env vars.
2. Document weekly Hermes Cron calling the MCP ingestion tool.
3. Run `npm test`, `npm run typecheck`, `npm run build`.
4. Run MCP smoke test and confirm the new ingestion tool is listed.

