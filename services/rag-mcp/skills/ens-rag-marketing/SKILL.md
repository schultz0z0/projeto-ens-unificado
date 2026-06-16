---
name: ens-rag-marketing
description: Use when Hermes works on ENS marketing, copy, campaigns, channels, tone of voice, or validated marketing memory.
---

# ENS RAG-MCP Marketing

This skill teaches Hermes how to use the `marketing` collection in the ENS RAG-MCP.

The `marketing` collection contains ENS marketing guidance: tone of voice, campaign principles, WhatsApp/e-mail/social rules, H2H, brand humanization and approved marketing memory.

## Use When

- The user asks for campaign ideas, copy, content plan, e-mail, WhatsApp, social posts or creative angles.
- The user asks how ENS should communicate with B2C, B2B, leads, students or the insurance market.
- The user validates a marketing output and asks Hermes to remember it.
- The user asks for tone of voice, H2H, brand humanization or channel strategy.

## Retrieval Pattern

Search `marketing` first for creative and communication rules.

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

## Combine With Other RAGs

- Add `courses` when the campaign or copy names a course.
- Add `insights` when performance, funnel, KPI, audience or budget context matters.
- Add `institutional` when brand authority, history or ENS identity matters.

## Output Discipline

For marketing deliverables, structure answers as:

1. Grounded facts used from the RAG-MCP.
2. Strategic interpretation.
3. Copy or campaign output.
4. Assumptions and missing data, if any.

## Save Rules

Do not save drafts automatically.

Use `ens_rag_save_marketing_memory` only when all conditions are true:

- The user explicitly validated or approved the output.
- The knowledge is reusable beyond the current chat.
- The validation note can be summarized.
- The content does not contain private personal data.

```json
{
  "tool": "ens_rag_save_marketing_memory",
  "arguments": {
    "title": "Copy aprovada para campanha B2C de curso ENS",
    "content": "Resumo reutilizavel do aprendizado aprovado.",
    "category": "copy",
    "user_validated": true,
    "validation_note": "Usuario aprovou como diretriz para proximas campanhas.",
    "actor_profile": "default"
  }
}
```

## Anti-Hallucination Rules

- Do not invent course facts; use `courses`.
- Do not claim a campaign performed well without `insights` or user-provided data.
- Do not save unapproved ideas, drafts or speculative directions.
- Keep strategic hypotheses labeled as hypotheses.
