begin;

select plan(12);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'audit_events'
      and column_name = any (array[
        'operator_origin', 'chat_session_id', 'run_id', 'tool_name',
        'tool_call_id', 'plan_id', 'plan_action_index'
      ])
  ),
  7,
  'audit events expose every Phase 4 correlation field'
);

select col_type_is('marketing_ops', 'audit_events', 'operator_origin', 'text', 'operator origin is text');
select col_type_is('marketing_ops', 'audit_events', 'chat_session_id', 'uuid', 'chat session id is uuid');
select col_type_is('marketing_ops', 'audit_events', 'run_id', 'uuid', 'run id is uuid');
select col_type_is('marketing_ops', 'audit_events', 'tool_name', 'text', 'tool name is text');
select col_type_is('marketing_ops', 'audit_events', 'tool_call_id', 'uuid', 'tool call id is uuid');
select col_type_is('marketing_ops', 'audit_events', 'plan_id', 'uuid', 'plan id is uuid');
select col_type_is('marketing_ops', 'audit_events', 'plan_action_index', 'integer', 'plan action index is integer');

select has_index('marketing_ops', 'audit_events', 'audit_events_chat_run_idx', 'chat/run lookup index exists');
select has_index('marketing_ops', 'audit_events', 'audit_events_tool_call_idx', 'tool call lookup index exists');
select ok(exists (
  select 1 from pg_constraint where conname = 'audit_events_operator_origin_valid'
), 'operator origin is constrained');
select ok(exists (
  select 1 from pg_constraint where conname = 'audit_events_plan_action_index_nonnegative'
), 'plan action index is nonnegative');

select * from finish();
rollback;
