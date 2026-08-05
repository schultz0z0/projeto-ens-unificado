begin;

select plan(21);

select has_type('marketing_ops', 'approval_kind', 'approval kind exists');
select has_type('marketing_ops', 'approval_status', 'approval status exists');
select has_type('marketing_ops', 'approval_risk', 'approval risk exists');
select has_type('marketing_ops', 'action_package_status', 'action package status exists');
select has_table('marketing_ops', 'approval_requests', 'approval requests exist');
select has_table('marketing_ops', 'approval_decisions', 'approval decisions exist');
select has_table('marketing_ops', 'action_packages', 'action packages exist');
select col_is_pk('marketing_ops', 'approval_requests', 'id', 'request id is primary key');
select col_is_pk('marketing_ops', 'approval_decisions', 'id', 'decision id is primary key');
select col_is_pk('marketing_ops', 'action_packages', 'id', 'package id is primary key');

select col_type_is('marketing_ops', 'approval_requests', 'version', 'bigint', 'request is versioned');
select col_type_is('marketing_ops', 'action_packages', 'payload', 'jsonb', 'package payload is jsonb');
select col_type_is('marketing_ops', 'action_packages', 'payload_hash', 'text', 'package hash is text');

select ok(
  exists (select 1 from pg_constraint where conname = 'approval_requests_target_matches_kind'),
  'request target is constrained by kind'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'approval_decisions_append_only'),
  'decision ledger is append-only'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'action_packages_payload_immutable'),
  'package payload is immutable'
);
select has_index('marketing_ops', 'approval_requests', 'approval_requests_queue_idx', 'queue index exists');
select has_index('marketing_ops', 'action_packages', 'action_packages_authorized_idx', 'authorized package index exists');
select ok(exists (select 1 from pg_trigger where tgname = 'approval_requests_state_machine'), 'request state machine exists');
select ok(exists (select 1 from pg_trigger where tgname = 'approval_requests_supersession_valid'), 'supersession guard exists');
select ok(exists (select 1 from pg_trigger where tgname = 'approval_notifications_service_write'), 'approval notification service boundary exists');

select * from finish();
rollback;
