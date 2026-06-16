---
name: nexusai-rag-client-workflow
description: Use when Hermes Agent must answer, create strategy, write copy, or run RAG workflows using the NexusAI RAG MCP, especially for NexusAI knowledge, ENS course data, multi-tenant client context, Supabase vector retrieval, hybrid search, ENS course context expansion, or controlled ingestion.
---

# NexusAI RAG Client Workflow

## Core Principle

Use the NexusAI RAG MCP as the only knowledge gateway between Hermes Agent and the Supabase RAG database. Do not query Supabase directly, do not call client APIs during normal answers, and do not invent facts that are not present in MCP results.

The MCP exists to give Hermes controlled access to:

- `nexusai`: internal NexusAI positioning, services, methodology, examples, and future manual knowledge.
- client tenants, currently `ens`: client-specific knowledge extracted into RAG.
- hybrid retrieval: semantic vector search plus full-text search.
- document expansion: load a full source document when top-k search returns only partial chunks.
- controlled ingestion: refresh source data into Supabase when an admin/ops workflow explicitly asks for it.

Hermes may expose MCP tools with their original names or with a server prefix such as `mcp_nexusai_rag_nexus_rag_search`. Use the actual tool names visible in the Hermes tool list. The examples below use the unprefixed MCP names.

## Tool Map

| Tool | Use For |
| --- | --- |
| `nexus_rag_context_status` | Check active client, role, allowed tenants, and admin mode before retrieval or ingestion. |
| `nexus_rag_set_active_client` | Set the client context, usually `ens`, before answering about a client. |
| `nexus_rag_search` | Primary hybrid/vector search across one or more authorized tenants. |
| `nexus_rag_get_document` | Expand a selected document/chunk when a search result is relevant but incomplete. |
| `nexus_rag_get_ens_course_context` | ENS-only full course context tool. Use for course copy, course details, FAQs, modules, offers, differentials, and page content. |
| `nexus_rag_list_sources` | Discover available sources by tenant and freshness. |
| `nexus_rag_ingest_source` | Admin/ops ingestion only. Do not use during normal answer generation. |
| `nexus_rag_audit_recent` | Admin/ops audit of recent MCP actions, ingestion runs, or access behavior. |

## Tenant Rules

Always treat tenants as hard boundaries.

- For NexusAI-only questions, search only `tenant_ids: ["nexusai"]`.
- For ENS-only questions, set active client `ens`, then search only `tenant_ids: ["ens"]`.
- For "Como a NexusAI pode ajudar a ENS?" or similar bridge questions, search both tenants separately: one query to `nexusai`, one query to `ens`, then synthesize.
- Never mix ENS knowledge into another client answer.
- Never mix one client tenant with another client tenant unless the user explicitly asks for a cross-client analysis and the current role permits it.
- If the MCP denies a tenant, do not bypass. Correct active client or explain that the context is not authorized.

Recommended setup before client work:

```json
{
  "tool": "nexus_rag_context_status",
  "arguments": {}
}
```

```json
{
  "tool": "nexus_rag_set_active_client",
  "arguments": {
    "client_id": "ens"
  }
}
```

## Retrieval Strategy

Use a retrieval ladder instead of stopping at the first result.

1. Start with `nexus_rag_search`.
2. Read top results and metadata: `tenant_id`, `source_id`, `title`, `section`, `chunk_kind`, and score if present.
3. If the answer needs the full source, call `nexus_rag_get_document`.
4. If the answer is about an ENS course, prefer `nexus_rag_get_ens_course_context` after identifying the course.
5. If results are sparse, re-query with synonyms, product/category names, and likely user terms.
6. If still sparse, say what was found and what is missing. Do not fill gaps with guesses.

Good search settings:

```json
{
  "tool": "nexus_rag_search",
  "arguments": {
    "query": "graduacao gestao de seguros matriz curricular publico alvo diferenciais faq",
    "tenant_ids": ["ens"],
    "limit": 8,
    "search_mode": "hybrid"
  }
}
```

Use tenant-constrained searches for synthesis:

```json
{
  "tool": "nexus_rag_search",
  "arguments": {
    "query": "NexusAI automacao atendimento marketing vendas agentes IA RAG",
    "tenant_ids": ["nexusai"],
    "limit": 6,
    "search_mode": "hybrid"
  }
}
```

```json
{
  "tool": "nexus_rag_search",
  "arguments": {
    "query": "ENS cursos graduacao pos graduacao seguros educacao publico diferencial",
    "tenant_ids": ["ens"],
    "limit": 8,
    "search_mode": "hybrid"
  }
}
```

## ENS Course Workflow

ENS course content is special. It comes from the ENS website API, is normalized during ingestion, and is stored in the `ens` tenant. The normal user-facing answer must use RAG, not the ENS API.

Use this workflow for requests like:

- "Crie uma copy para o curso Graduacao em Gestao de Seguros."
- "Quais sao os diferenciais desse curso da ENS?"
- "Monte uma campanha para o MBA em seguros."
- "Responda FAQ sobre um curso da ENS."

Steps:

1. Set active client to `ens`.
2. Search the course name in tenant `ens`.
3. Call `nexus_rag_get_ens_course_context` with the best course title/name.
4. Use the returned sections as grounded facts.
5. Separate facts from creative copy. Creative suggestions can be generated, but factual claims must come from RAG.

Example:

```json
{
  "tool": "nexus_rag_get_ens_course_context",
  "arguments": {
    "course_name": "Gestao de Seguros",
    "include_chunks": true
  }
}
```

Expected ENS sections may include:

- `course_summary`
- `course_description`
- `audience_requirements`
- `modules`
- `faculty`
- `offers`
- `visual_content`
- `faqs`
- `differentials`
- `testimonials`

Not every course has every section. If `faculty` or `testimonials` are absent, say the RAG did not provide that information. Do not claim faculty names, dates, prices, modality, workload, modules, discounts, or eligibility requirements unless the course context includes them.

## ENS Ingestion Boundaries

ENS ingestion rules are exclusive to the ENS source and must not be applied globally.

ENS course filter:

- Include the course when `liberar_curso` is `available`.
- Include the course when `liberar_curso` is `blocked` and `exibir_sempre_pagina_interna` is `true`.
- Exclude the course only when `liberar_curso` is `blocked` and `exibir_sempre_pagina_interna` is `false`.

Normal answer generation must never call the ENS API directly. The ENS API is an ingestion input only.

The refresh model is replace-then-add:

1. remove old ENS source documents/chunks for the ENS source,
2. fetch the current ENS API JSON,
3. normalize one document per course,
4. create semantic chunks,
5. embed chunks,
6. write fresh data to Supabase.

Use ingestion only when the user explicitly asks for ingestion, refresh, sync, cron setup, or validation of the data pipeline.

Example admin ingestion:

```json
{
  "tool": "nexus_rag_ingest_source",
  "arguments": {
    "source_id": "ens_courses",
    "tenant_id": "ens",
    "mode": "replace",
    "admin_mode": true
  }
}
```

## NexusAI Knowledge Workflow

Use `nexusai` tenant for internal NexusAI context:

- company positioning,
- services,
- offers,
- agentic workflows,
- RAG/MCP capability,
- future manual content,
- strategic fit between NexusAI and a client.

For now, the NexusAI base may include example content. If the answer needs hard company facts and RAG only returns placeholders or examples, be explicit that the current base needs richer manual content.

Example:

```json
{
  "tool": "nexus_rag_search",
  "arguments": {
    "query": "NexusAI proposta valor automacao IA atendimento comercial RAG MCP",
    "tenant_ids": ["nexusai"],
    "limit": 6,
    "search_mode": "hybrid"
  }
}
```

## Cross-Tenant Synthesis

Use this for questions like "Como a NexusAI pode ajudar a ENS?".

Do not run one vague blended search and assume coverage. Use two grounded retrieval passes:

1. Search `nexusai` for NexusAI capabilities.
2. Search `ens` for ENS context, courses, audience, or relevant operational details.
3. Optionally expand top documents.
4. Build a response that maps NexusAI capabilities to ENS opportunities.
5. Label uncertainty when only one side of the evidence exists.

Recommended answer structure:

- short direct answer,
- NexusAI evidence,
- ENS evidence,
- mapped opportunities,
- suggested next actions,
- source notes.

Example synthesis logic:

```text
If NexusAI RAG says it provides AI agents, RAG, automation, and marketing/sales support,
and ENS RAG shows many courses with FAQs, modules, offers, and differentials,
then propose use cases such as course recommendation, course copy generation,
FAQ answering, admissions support, campaign personalization, and internal knowledge search.
```

Use "pode ajudar" language unless the RAG has proof of an existing implementation.

## Evidence Discipline

When answering from RAG:

- cite or mention the source names naturally when useful,
- preserve exact factual values returned by tools,
- prefer "o RAG da ENS informa..." over unsupported certainty,
- distinguish retrieved facts from generated recommendations,
- use the newest/source metadata if the tool provides it,
- ask for ingestion or missing documents when the evidence base is insufficient.

Minimum internal evidence check before a factual answer:

- Did at least one relevant result come from the correct tenant?
- Did the title/source match the user intent?
- Did the answer rely on full context if the question needs details?
- Did the answer avoid facts not present in retrieved chunks?

## Failure Handling

If `nexus_rag_search` returns no results:

1. Retry with simpler terms and synonyms.
2. Check `nexus_rag_list_sources` for the tenant.
3. If sources exist but results are weak, state that the RAG did not surface enough evidence.
4. If sources are missing, explain that ingestion/manual content is needed.

If a result is relevant but incomplete:

- use `nexus_rag_get_document`,
- for ENS courses, use `nexus_rag_get_ens_course_context`.

If access is denied:

- call `nexus_rag_context_status`,
- set the right active client if allowed,
- otherwise tell the user the requested tenant is outside the active/authorized context.

If the user requests ingestion during a normal answer:

- confirm it is an admin/ops action,
- avoid changing data unless the request is explicit,
- use `admin_mode: true` only when the environment/profile is authorized.

## Common Mistakes

- Do not call ENS API for a user question. The API feeds ingestion only.
- Do not use `nexus_rag_ingest_source` to answer ordinary questions.
- Do not assume `blocked` ENS courses are excluded. Only exclude `blocked` plus `exibir_sempre_pagina_interna: false` during ENS ingestion.
- Do not assume all ENS courses have faculty, FAQ, testimonials, modules, or offers.
- Do not answer cross-tenant strategy from only one tenant.
- Do not rely only on top-3 chunks for course copy; expand course context.
- Do not leak Supabase keys, OpenAI keys, ENS API keys, raw headers, or internal env values.
- Do not bypass tenant policy with direct database or API calls.

## Quick Decision Table

| User Intent | Tool Pattern |
| --- | --- |
| Ask about NexusAI | Search `tenant_ids: ["nexusai"]`. |
| Ask about ENS generally | Set active client `ens`; search `tenant_ids: ["ens"]`. |
| Ask about one ENS course | Search ENS, then `nexus_rag_get_ens_course_context`. |
| Ask for copy/campaign for ENS course | Full ENS course context first, then write creative output. |
| Ask how NexusAI can help ENS | Search `nexusai` and `ens` separately, then synthesize. |
| Ask to refresh ENS data | Admin ingestion `ens_courses`, tenant `ens`, replace mode. |
| Ask to add NexusAI manual content | Admin/manual ingestion path for tenant `nexusai`; do not use ENS rules. |
| Ask what data exists | `nexus_rag_list_sources`, then targeted searches. |

