---
name: ens-rag-institutional
description: Use when Hermes needs grounded institutional ENS knowledge, identity, history, purpose, units, or official reference context.
---

# ENS RAG-MCP Institutional

This skill teaches Hermes how to use the `institutional` collection in the ENS RAG-MCP.

The `institutional` collection contains stable ENS reference knowledge. It is not a course catalog and not a marketing memory.

## Use When

- The user asks "quem e a ENS", "o que e a ENS", history, purpose, mission, vision or values.
- The user asks about ENS units, initiatives, ouvidoria or institutional context.
- Marketing work needs a credible institutional paragraph.
- A response must explain why ENS has authority in insurance education.

## Retrieval

Search only `institutional` unless the task explicitly needs another collection too.

```json
{
  "tool": "ens_rag_search",
  "arguments": {
    "query": "missao visao valores historia ENS",
    "collections": ["institutional"],
    "intent": "institutional",
    "limit": 5,
    "require_evidence": true
  }
}
```

## Combine With Other RAGs

- Add `courses` when the institutional answer references a specific course.
- Add `marketing` when writing brand/campaign language.
- Add `insights` when the question asks how institutional positioning connects to funnel or performance.

## Read-Only Rule

This collection is read-only for Hermes in normal use. Do not save new institutional knowledge unless the MCP owner explicitly asks for an institutional ingestion/update process.

## Anti-Hallucination Rules

- If the ENS RAG-MCP does not provide an institutional fact, say the institutional base does not currently contain it.
- Do not invent addresses, CNPJ, dates, phone numbers or official policies.
- Do not infer official ENS positions from marketing insights unless labeled as recommendation.
