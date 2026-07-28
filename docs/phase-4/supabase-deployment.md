# Supabase / schema deployment — Fase 4

- **Estado:** `migration_history_aligned_remote`
- **Data-base:** 2026-07-28
- **Observação:** migration aditiva obrigatória para F4-RF-11 aplicada no
  projeto Supabase conectado e com histórico local/remoto alinhado

## Decisão

Leituras MCP, plano e deep links reutilizam o schema atual. A auditoria exige
uma migration aditiva em `marketing_ops.audit_events` com:

- `operator_origin text` com valor permitido `hermes` quando preenchido;
- `chat_session_id uuid`;
- `run_id uuid`;
- `tool_name text`;
- `tool_call_id uuid`;
- `plan_id uuid`;
- `plan_action_index integer` não negativo;
- índices por `(tenant_id, chat_session_id, run_id)` e
  `(tenant_id, tool_call_id)`.

Os campos são opcionais para manter compatibilidade com REST e registros
anteriores. Não haverá FK para dados voláteis da Bridge/Hermes; UUID, tenant e
correlação são validados na delegação.

## Requisitos da migration

Ela foi desenhada para ser:

- aditiva;
- forward-only;
- coberta por pgTAP/contratos;
- acompanhada de dump, lint e diff;
- compatível com o caminho REST já validado;
- validada em banco limpo e sobre o baseline atual;
- reversível por remoção de índices/colunas somente antes de existirem
  evidências de produção; após uso, rollback funcional preserva auditoria.

## Evidência reconciliada

- migration aplicada: `apps/chat-web/supabase/migrations/20260722130000_phase_4_hermes_operator_audit.sql`;
- aplicação remota previamente executada no projeto conectado deste workspace;
- colunas confirmadas em `marketing_ops.audit_events` no remoto:
  `operator_origin`, `chat_session_id`, `run_id`, `tool_name`, `tool_call_id`,
  `plan_id` e `plan_action_index`;
- em 2026-07-28, a Supabase CLI identificou uma entrada remota órfã
  `20260722183310` e a ausência histórica de `20260722130000`; o reparo marcou
  a entrada órfã como `reverted` e a migration local como `applied`, sem rodar
  DDL;
- `supabase migration list --linked --workdir apps/chat-web` agora mostra
  `20260722130000` alinhada local/remoto; a listagem pelo MCP integrado mostra
  `phase_4_hermes_operator_audit` na mesma versão.

## Próximo uso na VPS

Se a VPS apontar para o mesmo Supabase remoto, não execute `supabase db push`
para esta migration: valide a listagem alinhada e siga para os smokes. Só
aplique schema se o ambiente de produção usar outro projeto, outra branch de
banco ou estiver comprovadamente desatualizado.
