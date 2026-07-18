begin;

select plan(34);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.item_dependencies')), 'item dependencies force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.content_assets')), 'content assets force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.content_versions')), 'content versions force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.item_artifacts')), 'item artifacts force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.in_app_notifications')), 'in-app notifications force RLS');

select ok(not has_table_privilege('anon', 'marketing_ops.item_dependencies', 'SELECT'), 'anon cannot read dependencies');
select ok(not has_table_privilege('anon', 'marketing_ops.content_assets', 'SELECT'), 'anon cannot read content assets');
select ok(not has_table_privilege('anon', 'marketing_ops.content_versions', 'SELECT'), 'anon cannot read content versions');
select ok(not has_table_privilege('anon', 'marketing_ops.item_artifacts', 'SELECT'), 'anon cannot read item artifacts');
select ok(not has_table_privilege('anon', 'marketing_ops.in_app_notifications', 'SELECT'), 'anon cannot read notifications');

select ok(has_table_privilege('authenticated', 'marketing_ops.item_dependencies', 'SELECT'), 'authenticated can read authorized dependencies');
select ok(has_table_privilege('authenticated', 'marketing_ops.content_assets', 'SELECT'), 'authenticated can read authorized content assets');
select ok(has_table_privilege('authenticated', 'marketing_ops.content_versions', 'SELECT'), 'authenticated can read authorized content versions');
select ok(has_table_privilege('authenticated', 'marketing_ops.item_artifacts', 'SELECT'), 'authenticated can read authorized item artifacts');
select ok(has_table_privilege('authenticated', 'marketing_ops.in_app_notifications', 'SELECT'), 'authenticated can read own notifications');

select ok(
  not has_table_privilege('authenticated', 'marketing_ops.content_versions', 'UPDATE')
    and not has_table_privilege('authenticated', 'marketing_ops.content_versions', 'DELETE'),
  'content versions have no public mutation grants'
);

select has_function('marketing_ops_private', 'can_access_campaign_item', array['uuid'], 'item access helper exists');
select has_function('marketing_ops_private', 'can_edit_campaign_item', array['uuid'], 'item edit helper exists');

select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure('marketing_ops_private.can_access_campaign_item(uuid)')),
  'item access helper is security definer'
);
select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure('marketing_ops_private.can_edit_campaign_item(uuid)')),
  'item edit helper is security definer'
);
select is(
  (select proconfig::text from pg_proc where oid = to_regprocedure('marketing_ops_private.can_access_campaign_item(uuid)')),
  '{"search_path=\"\""}',
  'item access helper has an empty search path'
);
select is(
  (select proconfig::text from pg_proc where oid = to_regprocedure('marketing_ops_private.can_edit_campaign_item(uuid)')),
  '{"search_path=\"\""}',
  'item edit helper has an empty search path'
);

select ok(not exists (
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = to_regprocedure('marketing_ops_private.can_access_campaign_item(uuid)')
    and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute item access helper');
select ok(not exists (
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = to_regprocedure('marketing_ops_private.can_edit_campaign_item(uuid)')
    and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute item edit helper');

select is(
  (select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'item_dependencies'),
  3,
  'dependencies expose select, insert, and delete policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'content_assets'),
  3,
  'content assets expose select, insert, and update policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'content_versions'),
  2,
  'content versions expose only select and insert policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'item_artifacts'),
  3,
  'item artifacts expose select, insert, and update policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'in_app_notifications'),
  3,
  'notifications expose select, insert, and update policies'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'marketing_ops'
      and tablename = 'in_app_notifications'
      and cmd = 'SELECT'
      and qual like '%auth.uid()%'
  ),
  'notification reads are scoped to auth.uid'
);

select has_function(
  'marketing_ops_private',
  'list_production_schedule',
  array[
    'timestamp with time zone', 'timestamp with time zone', 'uuid',
    'marketing_ops.item_kind', 'marketing_ops.item_channel', 'uuid',
    'marketing_ops.item_status', 'marketing_ops.item_priority',
    'timestamp with time zone', 'integer', 'uuid', 'integer'
  ],
  'canonical production schedule function exists'
);
select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.list_production_schedule(timestamptz,timestamptz,uuid,marketing_ops.item_kind,marketing_ops.item_channel,uuid,marketing_ops.item_status,marketing_ops.item_priority,timestamptz,integer,uuid,integer)'
  )),
  'canonical production schedule is security definer'
);
select is(
  (select proconfig::text from pg_proc where oid = to_regprocedure(
    'marketing_ops_private.list_production_schedule(timestamptz,timestamptz,uuid,marketing_ops.item_kind,marketing_ops.item_channel,uuid,marketing_ops.item_status,marketing_ops.item_priority,timestamptz,integer,uuid,integer)'
  )),
  '{"search_path=\"\""}',
  'canonical production schedule has an empty search path'
);
select ok(not exists (
  select 1
  from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = to_regprocedure(
    'marketing_ops_private.list_production_schedule(timestamptz,timestamptz,uuid,marketing_ops.item_kind,marketing_ops.item_channel,uuid,marketing_ops.item_status,marketing_ops.item_priority,timestamptz,integer,uuid,integer)'
  )
    and acl.grantee = 0
    and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute canonical production schedule');

select * from finish();
rollback;
