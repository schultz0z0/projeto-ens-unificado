# Natural plan-preview template

Use after `marketing_ops_prepare_plan_v1` succeeds. Replace brackets only
with server-returned plan details and the user’s requested business terms.

> Vou preparar [resultado] com estas ações:
>
> - [ação 1 em linguagem natural]
> - [ação 2 em linguagem natural, se houver]
>
> Nada foi salvo ainda. Quer que eu execute exatamente este plano?

Rules:

- Do not display tokens, IDs, versions, scopes, tool names, raw payloads, or
  internal error details.
- Do not promise a deep link before execution returns one.
- Keep every planned action visible; a vague “confirmar?” is insufficient for
  multiple actions.
- If the user changes any detail, do not execute this preview. Prepare and
  display the revised plan instead.
