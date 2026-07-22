# Supabase / schema deployment — Fase 4

- **Estado:** `required_planned`
- **Data-base:** 2026-07-22
- **Observação:** migration aditiva obrigatória para fechar F4-RF-11

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

Ela deve ser:

- aditiva;
- forward-only;
- coberta por pgTAP/contratos;
- acompanhada de dump, lint e diff;
- compatível com o caminho REST já validado;
- validada em banco limpo e sobre o baseline atual;
- reversível por remoção de índices/colunas somente antes de existirem
  evidências de produção; após uso, rollback funcional preserva auditoria.
