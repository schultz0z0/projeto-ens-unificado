---
name: ens-rag-courses
description: Use when Hermes needs grounded ENS course facts, course context, offers, links, or copy tied to a specific ENS course.
---

# ENS RAG-MCP Courses

This skill teaches Hermes how to use the `courses` collection in the ENS RAG-MCP.

The `courses` collection is the factual catalog of ENS courses ingested from the ENS site API. Hermes must treat it as the source of truth for course details.

## Use When

- The user asks about a course, program, offer, module, FAQ, link, workload, modality, faculty or enrollment.
- The user asks for copy, campaign or email about a specific ENS course.
- The user compares courses or asks which course fits a need.
- The user asks for factual support before marketing work.

## Tools

- `ens_rag_search`: use first when the course name is unclear.
- `ens_rag_get_course_context`: use after identifying a course; it returns fuller context for grounded work.

## Workflow

1. Search only `courses` if the course is unclear.
2. Choose the best matching course title from results.
3. Call `ens_rag_get_course_context` for that course.
4. Use facts from the context as grounding.
5. If generating copy, clearly separate factual course details from creative language.

## Search Example

```json
{
  "tool": "ens_rag_search",
  "arguments": {
    "query": "MBA financas seguros ENS",
    "collections": ["courses"],
    "intent": "course_fact",
    "limit": 5,
    "require_evidence": true
  }
}
```

## Full Course Context Example

```json
{
  "tool": "ens_rag_get_course_context",
  "arguments": {
    "course_name": "MBA Financas e Seguros"
  }
}
```

## Combine With Other RAGs

- Add `marketing` for copy, campaign, WhatsApp, email or social post.
- Add `insights` for funnel, KPI, performance or audience analysis.
- Add `institutional` when the response must explain ENS credibility or history.

## Hard Rules

- Never invent prices, dates, workload, modality, offers, discounts, faculty names or links.
- Never write course information back into the RAG-MCP.
- If the RAG-MCP does not contain the fact, say that the current ENS course base did not provide it.
- Do not use marketing language to fill missing facts.
