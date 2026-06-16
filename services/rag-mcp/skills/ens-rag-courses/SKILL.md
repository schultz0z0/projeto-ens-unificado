---
name: ens-rag-courses
description: Use when Hermes needs grounded ENS course facts, offers, links, or course-specific copy support.
---

# ENS RAG Courses

Use this skill for:

- course facts
- offers
- links de inscricao
- modulos
- FAQ
- diferenciais
- docentes
- copy grounded in a specific ENS course

## Workflow

1. Search `courses` with `ens_rag_search` when the course is not yet clear.
2. Use `ens_rag_get_course_context` once the course is identified.
3. Treat returned course data as factual grounding.
4. Separate grounded facts from generated copy.

## Rules

- Never invent prices, dates, workload, modalities, offers, or faculty names.
- Never write course information back into the RAG.
- If the RAG does not contain the fact, say that the current ENS course base did not provide it.
