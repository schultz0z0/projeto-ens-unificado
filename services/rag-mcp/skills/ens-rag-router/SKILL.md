---
name: ens-rag-router
description: Use when Hermes needs to choose the correct ENS RAG collection before searching or saving knowledge.
---

# ENS RAG Router

Use the ENS RAG MCP as the only knowledge gateway for ENS.

## Rules

- Do not query Supabase directly.
- Do not call the ENS API directly for user answers.
- Pick the right collection before searching:
  - `courses` for course facts, offers, links, modules, FAQs, faculty, and course-grounded copy.
  - `insights` for data analysis, funnel analysis, campaign analysis, and reusable dated conclusions.
  - `institutional` for "quem e a ENS", institutional facts, positioning, and internal reference context.
  - `marketing` for validated marketing knowledge and approved campaign learnings.
- Use `ens_rag_search` as the default entry point.
- Use `ens_rag_get_course_context` when the work is about one specific ENS course.
- Use save tools only when the task explicitly calls for preserving reusable knowledge.

## Write Guardrails

- Never write to `courses`.
- Never write to `institutional` in this version.
- Use `ens_rag_save_insight` only for meaningful reusable analysis.
- Use `ens_rag_save_marketing_memory` only after explicit user validation.
