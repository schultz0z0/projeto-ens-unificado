begin;

select plan(37);

select is(
  (
    select string_agg(e.enumlabel::text, ',' order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'marketing_ops' and t.typname = 'item_kind'
  ),
  'task,email,whatsapp,post,creative,review,milestone',
  'item kind is closed to the Phase 3 vocabulary'
);

select is(
  (
    select string_agg(e.enumlabel::text, ',' order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'marketing_ops' and t.typname = 'item_status'
  ),
  'draft,ready,in_review,completed,cancelled',
  'item status excludes reserved approval and execution states'
);

select is(
  (
    select string_agg(e.enumlabel::text, ',' order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'marketing_ops' and t.typname = 'item_priority'
  ),
  'low,normal,high,urgent',
  'item priority is closed'
);

select is(
  (
    select string_agg(e.enumlabel::text, ',' order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'marketing_ops' and t.typname = 'item_channel'
  ),
  'email,instagram,linkedin,facebook,whatsapp,website,paid_media,events,press,other',
  'item channel matches the campaign channel vocabulary'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_items'
      and column_name = any (array[
        'assignee_user_id', 'priority', 'channel', 'description', 'starts_at',
        'due_at', 'metadata', 'completed_at', 'cancelled_at'
      ])
  ),
  9,
  'campaign items expose every approved Phase 3 field'
);

select col_type_is('marketing_ops', 'campaign_items', 'kind', 'marketing_ops.item_kind', 'item kind uses its enum');
select col_type_is('marketing_ops', 'campaign_items', 'status', 'marketing_ops.item_status', 'item status uses its enum');
select col_type_is('marketing_ops', 'campaign_items', 'priority', 'marketing_ops.item_priority', 'item priority uses its enum');
select col_type_is('marketing_ops', 'campaign_items', 'channel', 'marketing_ops.item_channel', 'item channel uses its enum');
select is(
  (select column_default from information_schema.columns where table_schema = 'marketing_ops' and table_name = 'campaign_items' and column_name = 'status'),
  '''draft''::marketing_ops.item_status',
  'item status defaults to draft'
);
select is(
  (select column_default from information_schema.columns where table_schema = 'marketing_ops' and table_name = 'campaign_items' and column_name = 'priority'),
  '''normal''::marketing_ops.item_priority',
  'item priority defaults to normal'
);
select is(
  (select column_default from information_schema.columns where table_schema = 'marketing_ops' and table_name = 'campaign_items' and column_name = 'metadata'),
  '''{}''::jsonb',
  'item metadata defaults to an object'
);
select col_not_null('marketing_ops', 'campaign_items', 'title', 'item title is required');
select col_not_null('marketing_ops', 'campaign_items', 'metadata', 'item metadata is required');

select has_table('marketing_ops', 'item_dependencies', 'item dependencies table exists');
select has_table('marketing_ops', 'content_assets', 'content assets table exists');
select has_table('marketing_ops', 'content_versions', 'content versions table exists');
select has_table('marketing_ops', 'item_artifacts', 'item artifacts table exists');
select has_table('marketing_ops', 'in_app_notifications', 'in-app notifications table exists');

select has_pk('marketing_ops', 'item_dependencies', 'item dependencies have a primary key');
select has_pk('marketing_ops', 'content_assets', 'content assets have a primary key');
select has_pk('marketing_ops', 'content_versions', 'content versions have a primary key');
select has_pk('marketing_ops', 'item_artifacts', 'item artifacts have a primary key');
select has_pk('marketing_ops', 'in_app_notifications', 'in-app notifications have a primary key');

select ok(exists (select 1 from pg_constraint where conname = 'campaign_items_period_order'), 'item period order is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'campaign_items_title_valid'), 'item title is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'campaign_items_metadata_valid'), 'item metadata is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'campaign_items_terminal_timestamps'), 'terminal timestamps are constrained');
select ok(exists (select 1 from pg_constraint where conname = 'campaign_items_ready_fields'), 'ready and review fields are constrained');
select ok(exists (select 1 from pg_constraint where conname = 'item_dependencies_not_self'), 'dependency self-loops are constrained');
select ok(exists (select 1 from pg_constraint where conname = 'in_app_notifications_event_unique'), 'notification event keys are deduplicated');

select has_index('marketing_ops', 'campaign_items', 'campaign_items_tenant_starts_idx', 'start range index exists');
select has_index('marketing_ops', 'campaign_items', 'campaign_items_tenant_due_idx', 'due range index exists');
select has_index('marketing_ops', 'campaign_items', 'campaign_items_tenant_campaign_status_due_idx', 'campaign schedule index exists');
select has_index('marketing_ops', 'campaign_items', 'campaign_items_tenant_assignee_status_due_idx', 'assignee schedule index exists');

select is(
  (select count(*)::integer from marketing_ops.schema_versions where version = '2026-07-phase-3-calendar'),
  1,
  'schema version 3 is recorded idempotently'
);

select ok(
  not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'marketing_ops'
      and t.typname = 'item_status'
      and e.enumlabel = any (array['archived', 'approved', 'scheduled', 'executing', 'failed'])
  ),
  'legacy and reserved item statuses are absent'
);

select * from finish();
rollback;
