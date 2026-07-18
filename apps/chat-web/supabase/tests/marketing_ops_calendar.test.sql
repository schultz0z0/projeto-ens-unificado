begin;

select plan(58);

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

select has_function(
  'marketing_ops_private',
  'lock_item_dependency_pair',
  array['uuid', 'uuid'],
  'dependency pair lock helper exists'
);
select has_function(
  'marketing_ops_private',
  'enforce_item_dependency_graph',
  array[]::text[],
  'dependency graph trigger function exists'
);
select has_trigger(
  'marketing_ops',
  'item_dependencies',
  'item_dependencies_enforce_graph',
  'dependency graph trigger exists'
);
select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.lock_item_dependency_pair(uuid,uuid)'
  )),
  'dependency pair lock helper is security definer'
);
select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.enforce_item_dependency_graph()'
  )),
  'dependency graph trigger is security definer'
);
select is(
  (select proconfig::text from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.lock_item_dependency_pair(uuid,uuid)'
  )),
  '{"search_path=\"\""}',
  'dependency pair lock helper has an empty search path'
);
select is(
  (select proconfig::text from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.enforce_item_dependency_graph()'
  )),
  '{"search_path=\"\""}',
  'dependency graph trigger has an empty search path'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid in (
      to_regprocedure('marketing_ops_private.lock_item_dependency_pair(uuid,uuid)'),
      to_regprocedure('marketing_ops_private.enforce_item_dependency_graph()')
    )
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute dependency graph helpers'
);

select has_function(
  'marketing_ops_private',
  'create_content_version',
  array['uuid', 'bigint', 'text', 'jsonb', 'text', 'boolean'],
  'atomic content version function exists'
);
select has_function(
  'marketing_ops_private',
  'backfill_legacy_item_content',
  array[]::text[],
  'legacy content backfill function exists'
);
select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.create_content_version(uuid,bigint,text,jsonb,text,boolean)'
  )),
  'atomic content version function is security definer'
);
select is(
  (select proconfig::text from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.create_content_version(uuid,bigint,text,jsonb,text,boolean)'
  )),
  '{"search_path=\"\""}',
  'atomic content version function has an empty search path'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid in (
      to_regprocedure(
        'marketing_ops_private.create_content_version(uuid,bigint,text,jsonb,text,boolean)'
      ),
      to_regprocedure('marketing_ops_private.backfill_legacy_item_content()')
    )
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute content write/backfill functions'
);
select ok(
  has_function_privilege(
    'authenticated',
    'marketing_ops_private.create_content_version(uuid,bigint,text,jsonb,text,boolean)',
    'EXECUTE'
  ),
  'authenticated can execute the atomic content version function'
);
select ok(
  not has_table_privilege('authenticated', 'marketing_ops.content_versions', 'INSERT'),
  'authenticated cannot bypass atomic content version creation'
);
select is(
  (
    select array_length(constraint_meta.conkey, 1)
    from pg_constraint as constraint_meta
    where constraint_meta.conname = 'item_artifacts_asset_fk'
      and constraint_meta.conrelid = 'marketing_ops.item_artifacts'::regclass
  ),
  3,
  'item artifact asset FK includes tenant, item, and asset'
);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;
select throws_ok(
  $$
    select *
    from marketing_ops_private.create_content_version(
      'e7777777-7777-4777-8777-777777777777',
      null,
      'body',
      '{}'::jsonb,
      repeat('0', 64),
      false
    )
  $$,
  '23514',
  'Expected content asset version must be positive',
  'atomic content creation rejects a missing expected version'
);
reset role;

insert into marketing_ops.campaign_items (
  id, tenant_id, campaign_id, kind, title, content, created_by, updated_by
) values (
  'e7777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'c1111111-1111-4111-8111-111111111111',
  'email',
  'Legacy content fixture',
  '{"text":"legacy body"}'::jsonb,
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111'
);
select is(
  marketing_ops_private.backfill_legacy_item_content(),
  1,
  'legacy material content is backfilled once'
);
select ok(
  exists (
    select 1
    from marketing_ops.content_assets
    where item_id = 'e7777777-7777-4777-8777-777777777777'
      and asset_kind = 'legacy_campaign_item'
      and current_version_number = 1
      and version = 2
  ),
  'legacy item receives a stable asset at version one'
);
select ok(
  exists (
    select 1
    from marketing_ops.content_versions as content_version
    join marketing_ops.content_assets as asset
      on asset.tenant_id = content_version.tenant_id
      and asset.id = content_version.asset_id
    where asset.item_id = 'e7777777-7777-4777-8777-777777777777'
      and content_version.version_number = 1
      and content_version.body = '{"text": "legacy body"}'
      and content_version.content_hash ~ '^[0-9a-f]{64}$'
      and content_version.frozen_at is not null
  ),
  'legacy content is preserved in a frozen immutable version'
);
select is(
  marketing_ops_private.backfill_legacy_item_content(),
  0,
  'legacy content backfill is idempotent'
);

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
