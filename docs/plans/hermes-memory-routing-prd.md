# PRD: Hermes Memory + ENS RAG MCP + Nexus Graph MCP

## Status

Implemented for final pre-production validation.

## Summary

Nexus/Hermes must use three complementary memory layers:

- Hermes native persistent memory remains active and untouched.
- ENS RAG MCP provides source-backed ENS knowledge.
- Nexus Graph MCP provides tenant-scoped relational memory.

The goal is additive improvement. The MCPs reinforce Hermes; they do not replace or bypass the native Hermes memory system.

## Non-Negotiable Contract

Hermes native persistent memory stays intact.

- Do not disable Hermes memory.
- Do not replace Hermes memory with RAG or Graph.
- Do not intercept the existing Hermes session persistence path.
- Do not remove existing session continuity behavior.
- Continue letting Hermes record and recover conversation continuity as it already does.

RAG and Graph are native context/memory extensions:

- RAG adds authoritative documentary memory.
- Graph adds relational operational memory.
- Hermes memory remains the personal/session continuity layer.

## Memory Responsibilities

### Hermes Native Persistent Memory

Owns:

- User preferences.
- Conversation continuity.
- Session context.
- Personal working style.
- Short and long continuity that Hermes already persists.

This layer is always allowed to operate as it does today.

### ENS RAG MCP

Owns source-backed ENS knowledge:

- `courses`: course catalog, offers, links, modules, FAQs, faculty, and official course facts.
- `insights`: reusable dated analysis, funnels, campaign learnings, and performance conclusions.
- `institutional`: institutional ENS knowledge and reference context.
- `marketing`: validated ENS marketing learnings and approved campaign knowledge.

Use RAG when the answer needs:

- Official course detail.
- Source-backed content.
- Catalog facts.
- Institutional facts.
- Marketing knowledge already validated.
- Saved analysis.
- Grounded copy or strategy input.

### Nexus Graph MCP

Owns tenant-scoped relational memory:

- Relationships between course, persona, campaign, channel, CRM stage, KPI, objection, offer, and system.
- Durable operational decisions.
- Impact maps.
- Dependency maps.
- Journey maps.
- References back to RAG sources.

Graph must not duplicate long RAG content. It stores relationships and pointers, not course descriptions or document bodies.

## Routing Rules

| User intent | Primary layer | Secondary layer | Write policy |
| --- | --- | --- | --- |
| Official course facts | ENS RAG `courses` | Graph only for relationships | No write |
| Course copy | ENS RAG `courses` | ENS RAG `marketing` | No write by default |
| Marketing strategy | ENS RAG `marketing`, `courses`, `insights` | Graph for relationship map | Optional validated write |
| Analysis or performance question | ENS RAG `insights` | Graph for related KPI/campaign map | Save only validated insights |
| Institutional ENS context | ENS RAG `institutional` | None by default | No write |
| Journey, impact, dependency, or relationship | Graph | RAG for source validation | Graph write if durable |
| User preference or style | Hermes memory | None | Hermes memory |
| Operational decision | Graph | Hermes memory for continuity | Graph write if durable |
| New validated marketing learning | ENS RAG `marketing` | Graph if relational | RAG write requires validation |

## Runtime Prompt Contract

Every normal Hermes session turn should receive this routing policy:

- Hermes native memory remains active.
- MCP RAG ENS and Graph add context natively.
- RAG is for official/source-backed content.
- Graph is for durable relationships, impact, dependencies, journeys, and decisions.
- Hybrid tasks use Graph for relationships and RAG for facts.
- Graph must not store full course catalog text.
- Durable writes require clear value, validation, or user request.

## Graph Minimal Schema

Recommended node kinds:

- `CourseRef`
- `Persona`
- `Campaign`
- `Channel`
- `FunnelStage`
- `Objection`
- `Offer`
- `KPI`
- `System`
- `Decision`
- `InsightRef`

Recommended relation types:

- `TARGETS`
- `PROMOTES`
- `HAS_OBJECTION`
- `USES_CHANNEL`
- `MEASURED_BY`
- `DEPENDS_ON`
- `DERIVED_FROM`
- `VALIDATED_BY`
- `IMPACTS`

Each RAG-derived graph item should include:

- `tenant_id`
- `source_collection`
- `source_document_id` or `source_uri`
- `confidence`
- `last_verified_at`

## Implementation Scope

### Phase 1: Safe Foundation

- Fix Graph MCP `LIMIT` handling so Neo4j receives integer limits.
- Add native memory-routing contract to Hermes chat payloads.
- Add rollback flag for the native memory-routing contract.
- Propagate tenant/user context from frontend to bridge and from bridge to Hermes.
- Require explicit validation for durable Graph writes.
- Preserve existing Hermes memory/session behavior.

### Phase 2: RAG to Graph Relationship Sync

- Build a job/tool that reads selected RAG sources and creates lightweight Graph references.
- Store only relationships and source pointers in Graph.
- Avoid copying course descriptions, modules, or long content into Graph.
- Keep RAG Supabase separate from the app/frontend Supabase and from Neo4j; sync uses the RAG MCP internal endpoint, not direct cross-database coupling.
- Require admin mode, explicit validation, and a validation note before Graph writes.

### Phase 3: Observability

- Log which layer was used per chat turn: Hermes memory, RAG, Graph, or hybrid.
- Include tenant id and tool namespace in internal diagnostics.
- Surface Graph health and search failures in the admin/debug view.
- Preserve Hermes memory as always active in diagnostics even when no MCP tool call is observed.

### Phase 4: White-Label Hardening

- Use trusted tenant source for routing.
- Keep ENS as first tenant.
- Prepare database-per-tenant or equivalent isolation for future clients.
- In production authenticated sessions, prefer Supabase user/app metadata for tenant routing over client-provided tenant headers.

## Acceptance Criteria

- Existing Hermes memory behavior remains intact.
- Normal chat turns include the memory-routing contract.
- `X-Tenant-Id` and `X-User-Id` flow from frontend to bridge and from bridge to Hermes.
- Graph `search` and `neighbors` no longer fail because of float-like `LIMIT` values.
- Graph `upsert_fact` and `relate` writes require explicit validation and a validation note.
- Course-detail questions use RAG as primary source.
- Relationship/impact/journey questions use Graph as primary source.
- Hybrid strategy questions can use both RAG and Graph.
- Graph stores references and relationships, not full RAG document bodies.
- Marketing memory writes require explicit validation.
- RAG-to-Graph sync writes require admin mode, explicit validation, and a validation note.
- The bridge exposes authenticated memory diagnostics including layer usage and Graph health.
- ENS is the default first tenant in the production compose path.

## Definition of Done

The system keeps Hermes persistent memory working exactly as the continuity layer, while RAG MCP and Graph MCP become native additive layers:

- RAG is the ENS knowledge library.
- Graph is the relational memory map.
- Hermes memory is the always-on continuity memory.
