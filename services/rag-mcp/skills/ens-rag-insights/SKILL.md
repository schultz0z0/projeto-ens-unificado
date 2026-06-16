---
name: ens-rag-insights
description: Use when Hermes needs ENS analytical insights, funnel analysis, campaign analysis, or to save reusable dated analysis.
---

# ENS RAG Insights

Use this skill for analytical work about ENS, including:

- funnel analysis
- campaign analysis
- email marketing performance analysis
- course performance analysis
- dated conclusions that may become stale over time

## Retrieval

- Search `insights` first for previous analysis.
- Bring in `courses` only when course context helps explain the analysis.
- Prefer recent insights.
- Do not rely on old insights unless the user asks for historical comparison.

## Save Rules

Use `ens_rag_save_insight` only when:

- the analysis is meaningful and reusable later
- it has a clear subject
- it includes enough evidence/context to be useful
- the date matters

Include:

- title
- summary
- analysis
- subject
- analysis date
- evidence when available
- related course or funnel when relevant
