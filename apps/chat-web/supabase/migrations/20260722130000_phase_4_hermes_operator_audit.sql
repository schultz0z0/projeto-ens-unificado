alter table marketing_ops.audit_events
  add column operator_origin text,
  add column chat_session_id uuid,
  add column run_id uuid,
  add column tool_name text,
  add column tool_call_id uuid,
  add column plan_id uuid,
  add column plan_action_index integer,
  add constraint audit_events_operator_origin_valid
    check (operator_origin is null or operator_origin = 'hermes'),
  add constraint audit_events_tool_name_valid
    check (tool_name is null or btrim(tool_name) <> ''),
  add constraint audit_events_plan_action_index_nonnegative
    check (plan_action_index is null or plan_action_index >= 0);

create index audit_events_chat_run_idx
  on marketing_ops.audit_events (tenant_id, chat_session_id, run_id)
  where chat_session_id is not null and run_id is not null;

create index audit_events_tool_call_idx
  on marketing_ops.audit_events (tenant_id, tool_call_id)
  where tool_call_id is not null;

comment on column marketing_ops.audit_events.origin is
  'Transport origin such as rest or mcp.';
comment on column marketing_ops.audit_events.operator_origin is
  'Conversational operator origin; hermes for Phase 4 delegated calls.';
comment on column marketing_ops.audit_events.tool_call_id is
  'Marketing Ops generated UUID for one MCP invocation.';
