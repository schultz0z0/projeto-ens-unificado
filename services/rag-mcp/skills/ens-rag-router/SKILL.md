---
name: ens-rag-router
description: Use when Hermes answers or reasons about ENS and must choose which ENS RAG-MCP collection or tool to use.
---

# ENS RAG-MCP Router

This skill teaches Hermes how to use the ENS RAG-MCP. The ENS RAG-MCP is the only approved gateway for ENS knowledge stored in Supabase.

## Non-Negotiables

- Do not query Supabase directly.
- Do not call the ENS course API directly during normal answers.
- Do not invent ENS facts when the RAG-MCP returns no evidence.
- Use the actual MCP tool names visible to Hermes. They may appear as `ens_rag_search` or with a server prefix.
- Use `ens_rag_search` as the default entry point.
- Use `ens_rag_get_course_context` when the task is about one specific course.

## Collections

| Collection | Use For | Write? |
| --- | --- | --- |
| `courses` | Course facts, links, offers, modules, FAQs, workload, modality, faculty, course-grounded copy. | Never write. Refreshed from ENS site API. |
| `institutional` | Who ENS is, history, purpose, mission, vision, values, units, initiatives, ouvidoria. | Never write in normal Hermes use. |
| `marketing` | ENS tone, copy patterns, campaign guidelines, B2C channels, WhatsApp, H2H, approved marketing memory. | Write only after explicit user validation. |
| `insights` | Funnels, KPIs, campaign analysis, performance conclusions, dashboards, dated analytical memory. | Write meaningful dated analysis. |

## Routing Matrix

| User Task | Search Collections |
| --- | --- |
| "Fale sobre a ENS" | `institutional` |
| "Crie copy para o curso X" | `courses`, then `marketing` |
| "Monte campanha para o curso X" | `courses`, `marketing`, optionally `insights` |
| "Analise esse funil/campanha" | `insights`, optionally `courses` if course-specific |
| "Qual curso tem tal carga horaria/link/oferta?" | `courses` only, then `ens_rag_get_course_context` |
| "Salve esta analise para uso futuro" | `ens_rag_save_insight` |
| "Essa copy foi aprovada, salve como aprendizado" | `ens_rag_save_marketing_memory` |

## Search Pattern

For narrow tasks, always pass explicit `collections`.

```json
{
  "tool": "ens_rag_search",
  "arguments": {
    "query": "tom de voz WhatsApp campanha B2C ENS",
    "collections": ["marketing"],
    "intent": "marketing_strategy",
    "limit": 5,
    "require_evidence": true
  }
}
```

For combined tasks, search the most factual collection first, then the strategic one.

Example: campaign for a specific course:

1. `courses` to ground course facts.
2. `marketing` for voice, channel and copy rules.
3. `insights` if performance, funnel, KPI or analytics context matters.

## Anti-Hallucination Rules

- If no result is returned, say the ENS RAG-MCP did not provide grounded evidence.
- Never invent price, dates, workload, modality, faculty, discount, deadline or course link.
- Separate "RAG evidence" from "strategic recommendation".
- Mark hypotheses as hypotheses.
- Use `include_stale: false` or `freshness_days` for analytical tasks unless the user asks for historical context.

## Write Guardrails

- `courses` and `institutional` are read-only for Hermes.
- `ens_rag_save_insight` is for reusable analysis with date, subject and evidence.
- `ens_rag_save_marketing_memory` requires explicit user validation before saving.
- Do not save drafts, brainstorming fragments or unapproved copy.
