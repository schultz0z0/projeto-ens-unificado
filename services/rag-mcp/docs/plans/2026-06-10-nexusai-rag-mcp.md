# NexusAI RAG MCP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Hermes-compatible HTTP MCP server that mediates future Supabase RAG access with tenant isolation.

**Architecture:** A Node.js/TypeScript MCP server exposes Streamable HTTP at `/mcp`, health at `/health`, and tool handlers backed by small policy and repository modules. YAML controls server behavior and `.env` supplies Supabase secrets.

**Tech Stack:** TypeScript, Node.js 22, official MCP TypeScript SDK v1, Express, Supabase JS, Zod, YAML, Vitest, Docker Compose.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Write config and package files**

Create a TypeScript ESM project with scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

**Step 2: Verify**

Run: `npm install`
Expected: dependencies install.

Run: `npm run typecheck`
Expected: no TypeScript errors after implementation.

### Task 2: Tenant Policy TDD

**Files:**
- Create: `src/policy/tenantPolicy.test.ts`
- Create: `src/policy/tenantPolicy.ts`

**Step 1: Write failing tests**

Cover:
- specialist with active client can access `nexusai` and that active client
- specialist cannot access another client
- missing active client limits specialist to `nexusai`
- admin requires explicit admin mode for broad access

**Step 2: Run failing test**

Run: `npx vitest run src/policy/tenantPolicy.test.ts`
Expected: fail because module does not exist.

**Step 3: Implement minimal policy**

Implement `resolveTenantScope` and `assertTenantAccess`.

**Step 4: Run passing test**

Run: `npx vitest run src/policy/tenantPolicy.test.ts`
Expected: pass.

### Task 3: Config Loader

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/loadConfig.ts`
- Create: `config/nexusai-rag-mcp.yaml`

**Step 1: Write tests if behavior grows**

For MVP, keep the loader small and rely on Zod validation.

**Step 2: Implement**

Load YAML from `NEXUSAI_RAG_MCP_CONFIG` or `config/nexusai-rag-mcp.yaml`.

### Task 4: Supabase Repository

**Files:**
- Create: `src/rag/ragRepository.ts`
- Create: `src/rag/types.ts`
- Create: `supabase/schema.sql`

**Step 1: Implement interface**

Define repository methods:
- `searchChunks`
- `listSources`
- `getDocument`
- `auditRecent`
- `recordQuery`
- `recordAuditEvent`

**Step 2: Implement Supabase adapter**

Use `@supabase/supabase-js`. If env vars are missing, repository returns clear unavailable errors.

### Task 5: MCP Tools

**Files:**
- Create: `src/mcp/createServer.ts`
- Create: `src/mcp/toolResults.ts`
- Create: `src/context/activeContext.ts`

**Step 1: Register tools**

Register:
- `nexus_rag_search`
- `nexus_rag_set_active_client`
- `nexus_rag_context_status`
- `nexus_rag_list_sources`
- `nexus_rag_get_document`
- `nexus_rag_audit_recent`

**Step 2: Enforce tenant policy**

Every tool that touches tenant data calls policy before repository access.

### Task 6: HTTP Entrypoint

**Files:**
- Create: `src/index.ts`

**Step 1: Implement Streamable HTTP**

Expose:
- `POST /mcp`
- `GET /health`

Return 405 for unsupported MCP GET/DELETE until stateful SSE is needed.

### Task 7: Docker and Hermes Docs

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docs/hermes-config.example.yaml`
- Create: `README.md`

**Step 1: Add deployment files**

Keep the compose service independently deployable and ready to join the future Hermes compose network.

**Step 2: Document**

Explain env vars, YAML config, Supabase setup, and Hermes `mcp_servers` snippet.

### Task 8: Verification

**Files:**
- All created files

**Step 1: Run tests**

Run: `npm test`
Expected: pass.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: pass.

**Step 3: Build**

Run: `npm run build`
Expected: `dist/` emitted.

