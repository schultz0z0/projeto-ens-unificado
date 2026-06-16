---
name: ens-rag-insights
description: Use when Hermes analyzes ENS funnels, campaigns, KPIs, performance data, dashboards, or reusable dated insights.
---

# ENS RAG-MCP Insights

This skill teaches Hermes how to use the `insights` collection in the ENS RAG-MCP.

The `insights` collection stores analytical knowledge: funnels, KPIs, campaign lessons, dashboard logic, performance hypotheses and dated conclusions.

## Use When

- The user sends campaign, funnel, e-mail marketing, CRM, ads, sales or dashboard data.
- The user asks what happened, why it happened, or what to do next.
- The user asks about CAC, ROAS, CPL, MQL, SQL, enrollment, LTV, churn, payback or conversion.
- The user asks Hermes to remember a useful analysis.

## Retrieval Pattern

Search `insights` first for analytical memory.

```json
{
  "tool": "ens_rag_search",
  "arguments": {
    "query": "funil CAC ROAS MQL SQL matricula campanha ENS",
    "collections": ["insights"],
    "intent": "analytics",
    "limit": 5,
    "freshness_days": 180,
    "include_stale": false,
    "require_evidence": true
  }
}
```

## Combine With Other RAGs

- Add `courses` if the analysis is about a specific course.
- Add `marketing` if the output includes campaign/copy/channel recommendations.
- Add `institutional` if the answer depends on ENS identity or authority.

## Analysis Standard

For analytical answers, use this structure:

1. What happened.
2. Evidence and metrics.
3. Likely causes, ranked by evidence.
4. Risks or data limitations.
5. Recommended next actions.
6. What should be measured next.

## Freshness Rules

- Prefer recent insights for active campaigns and funnels.
- Use old insights only for historical comparison or explicit long-term context.
- If a retrieved insight may be stale, say so.
- Ask for the date/window when the user provides data without timeframe.

## Save Rules

Use `ens_rag_save_insight` only when:

- the analysis is meaningful and reusable later;
- it has a clear subject;
- it includes evidence, source context or user-provided data summary;
- the date/window matters;
- it avoids personal data and unnecessary raw rows.

```json
{
  "tool": "ens_rag_save_insight",
  "arguments": {
    "title": "Insight sobre funil do curso X",
    "summary": "Resumo curto do aprendizado.",
    "analysis": "Analise com evidencias, limitacoes e proximas acoes.",
    "subject": "funil de marketing do curso X",
    "analysis_date": "2026-06-16",
    "metrics_period": "ultimos 30 dias",
    "confidence": "medium",
    "stale_after_days": 90,
    "evidence": ["Dado ou observacao fornecida pelo usuario"],
    "actor_profile": "default"
  }
}
```

## Anti-Hallucination Rules

- Do not invent metrics, dates, spend, leads, conversion or revenue.
- If data is missing, state what is missing and provide a hypothesis clearly labeled.
- Do not treat benchmark text as current ENS performance.
- Do not save raw personal data.
