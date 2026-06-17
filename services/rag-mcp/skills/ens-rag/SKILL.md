---
name: ens-rag
description: Use when Hermes must consult or write ENS knowledge through the ENS RAG-MCP, especially ENS courses, offers, institutional facts, marketing guidance, or dated analytical insights.
---

# ENS RAG-MCP

This skill teaches Hermes how to use the ENS RAG-MCP. The ENS RAG-MCP is the only approved gateway for ENS knowledge stored in Supabase.

## Non-Negotiables

- Use the ENS RAG-MCP tools; do not query Supabase directly.
- Do not call the ENS site course API directly during normal answers.
- Do not invent ENS facts when the RAG-MCP returns no evidence.
- Treat the `courses` collection as the source of truth for course facts.
- Never invent course price, dates, modality, workload, enrollment deadline, faculty, discount, offer status, or links.
- If evidence is missing or ambiguous, say the ENS RAG-MCP did not provide enough evidence and ask a focused follow-up.
- Separate grounded facts from strategic recommendations.

## Tool Map

- `ens_rag_search`: default search entry point with routing, filters, hybrid search and reranking.
- `ens_rag_get_course_context`: full grounded context for one identified course.
- `ens_rag_get_document`: load a full document by id.
- `ens_rag_list_collections`: inspect collection counts/freshness.
- `ens_rag_ingest_courses`: admin-only refresh from ENS site API.
- `ens_rag_ingest_institutional`: admin-only refresh from versioned institutional Markdown.
- `ens_rag_ingest_marketing`: admin-only refresh from versioned marketing Markdown.
- `ens_rag_ingest_insights`: admin-only refresh from versioned insights Markdown.
- `ens_rag_save_insight`: save reusable dated analytical insight.
- `ens_rag_save_marketing_memory`: save explicitly user-validated marketing knowledge.
- `ens_rag_audit_recent`: admin-only audit trail.

Tool names may appear with a server prefix in Hermes. Use the actual visible tool name.

## Collections

| Collection | Use For | Write Rule |
| --- | --- | --- |
| `courses` | ENS course catalog, offers, links, workload, modules, FAQs, faculty, course-grounded copy. | Read-only for Hermes. Refreshed from ENS site API. |
| `institutional` | ENS identity, history, purpose, mission, vision, values, units, initiatives, ouvidoria. | Read-only in normal use. |
| `marketing` | ENS tone, copy patterns, channel guidance, campaign principles, H2H, approved marketing memory. | Write only after explicit user validation. |
| `insights` | Funnels, KPIs, campaigns, performance conclusions, dashboard logic, dated analysis memory. | Write meaningful reusable analysis with date/evidence. |

## Routing

- Institutional facts: search `institutional`.
- Course facts: search `courses`; then call `ens_rag_get_course_context` for a specific course.
- Course copy/campaign: first `courses`, then `marketing`, optionally `insights`.
- Funnel/campaign analytics: first `insights`, add `courses` if course-specific, add `marketing` if recommending communication.
- Validated marketing memory: use `ens_rag_save_marketing_memory`.
- Reusable analytical memory: use `ens_rag_save_insight`.

## Course Precision Workflow

Courses are high-stakes. Be stricter here than in other collections.

1. If the course name is unclear, use `ens_rag_search` on `courses` only.
2. If the user asks about one course and a candidate is identified, call `ens_rag_get_course_context`.
3. If the user asks about offers, links, dates, investment, enrollment, modality, location or class status, search `course_offer` chunks with course filters.
4. If multiple courses match, present candidates and ask which one instead of guessing.
5. If course evidence is absent, say the current ENS course base did not provide the fact.

Offer-focused search example:

```json
{
  "tool": "ens_rag_search",
  "arguments": {
    "query": "link de inscricao investimento e data de inicio do MBA X",
    "collections": ["courses"],
    "intent": "course_fact",
    "limit": 8,
    "course_filters": {
      "chunk_kinds": ["course_offer"],
      "offer_statuses": ["available"],
      "only_active_offers": true
    },
    "require_evidence": true
  }
}
```

Useful course filters:

- `chunk_kinds`: `course_summary`, `course_description`, `audience_requirements`, `modules`, `faculty`, `course_offer`, `visual_content`, `faqs`, `differentials`, `testimonials`.
- `course_categories`: examples from the ENS API include `Qualificações`, `Pós`, `Ser Corretor`, `Graduação`.
- `course_types`: examples include `MBA`, `Pós-graduação`, `Extensão`, `Qualificação Técnica`, `Gratuito`, `Speed Training`, `Certificação em Seguros`.
- `course_statuses`: `available`, `blocked`.
- `offer_statuses`: `available`, `blocked`.
- `modalities`: examples include `Online - Aulas ao Vivo`, `On-line`, `Presencial`, `Semi-presencial`.
- `localities`: use text such as `Online`, `Rio de Janeiro`, `Lisboa`, `London`, `New York`.
- `offer_start_from` and `offer_start_to`: ISO datetime windows for class start.
- `enrollment_open_at`: ISO datetime to find offers with enrollment open at that moment.
- `only_active_offers`: use `true` for current enrollment/link questions unless the user asks for blocked/old/all offers.

Course context example:

```json
{
  "tool": "ens_rag_get_course_context",
  "arguments": {
    "course_name": "MBA Financas e Seguros",
    "actor_profile": "default"
  }
}
```

## Marketing Workflow

For marketing tasks:

1. Search `marketing` for tone/channel/copy rules.
2. Search `courses` if a course is named.
3. Search `insights` if performance, funnel, KPI or audience data matters.
4. Produce grounded facts first, then strategic interpretation, then copy/output.
5. Label hypotheses clearly.

Do not save drafts automatically. Use `ens_rag_save_marketing_memory` only after explicit user approval, with a validation note.

## Insights Workflow

For analysis:

1. Search `insights` with `freshness_days` and `include_stale: false` for active decisions.
2. Add `courses` when the analysis is course-specific.
3. State data window, evidence, likely causes, risks, and next actions.
4. Save with `ens_rag_save_insight` only if reusable and dated.

Insight save must include subject, summary, analysis, date or metrics period, confidence when possible, and evidence. Do not store personal data or raw unnecessary rows.

## Institutional Workflow

Use `institutional` for who ENS is, purpose, history, values, units, initiatives and ouvidoria. Do not infer official facts from marketing or insights. If addresses, CNPJ, dates or official policies are absent, say so.

## Reranking And Evidence

The MCP can rerank results internally. Treat top results as prioritized evidence, but still read content and metadata. If `reranker.warning` appears, continue with returned evidence and mention uncertainty only if it affects the answer.

## Anti-Hallucination Output Rules

- For factual answers, cite only facts present in RAG evidence.
- For strategic work, clearly separate:
  1. grounded ENS facts;
  2. interpretation;
  3. recommendation or copy.
- Do not use marketing language to fill missing course facts.
- Do not transform stale insights into current performance claims.
- If a tool returns zero results, do not answer as if you know. Ask for clarification or say the RAG-MCP has no grounded evidence.
