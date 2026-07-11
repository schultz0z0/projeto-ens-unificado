begin;

select plan(95);

select has_schema('marketing_ops', 'marketing_ops schema exists');
select has_schema('marketing_ops_private', 'private helper schema exists');

select is(
  (select count(*)::integer from marketing_ops.tenants where slug = 'ens' and active),
  1,
  'ENS tenant is bootstrapped idempotently'
);
select has_function(
  'marketing_ops_private',
  'sync_ens_profile_membership',
  array[]::text[],
  'profile membership sync function exists'
);
select has_trigger(
  'public',
  'profiles',
  'profiles_sync_ens_marketing_membership',
  'profiles synchronize ENS memberships'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
  'authenticated', 'authenticated', 'membership-sync@local.test', crypt('local-test-password', gen_salt('bf')),
  now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, tenant_id)
values ('55555555-5555-4555-8555-555555555555', 'membership-sync@local.test', 'Membership Sync', 'manager', 'ens')
on conflict (id) do update set role = excluded.role, tenant_id = excluded.tenant_id;

select is(
  (select count(*)::integer from marketing_ops.memberships
   where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and user_id = '55555555-5555-4555-8555-555555555555'
     and role = 'manager' and active),
  1,
  'profile changes synchronize a trusted active membership'
);

select has_table('marketing_ops', 'tenants', 'tenants table exists');
select has_table('marketing_ops', 'memberships', 'memberships table exists');
select has_table('marketing_ops', 'campaigns', 'campaigns table exists');
select has_table('marketing_ops', 'campaign_members', 'campaign_members table exists');
select has_table('marketing_ops', 'campaign_items', 'campaign_items table exists');
select has_table('marketing_ops', 'audit_events', 'audit_events table exists');
select has_table('marketing_ops', 'domain_events', 'domain_events table exists');
select has_table('marketing_ops', 'idempotency_records', 'idempotency_records table exists');
select has_table('marketing_ops', 'delegation_uses', 'delegation_uses table exists');
select has_table('marketing_ops', 'schema_versions', 'schema_versions table exists');

select has_pk('marketing_ops', 'tenants', 'tenants has a primary key');
select has_pk('marketing_ops', 'memberships', 'memberships has a primary key');
select has_pk('marketing_ops', 'campaigns', 'campaigns has a primary key');
select has_pk('marketing_ops', 'campaign_members', 'campaign_members has a primary key');
select has_pk('marketing_ops', 'campaign_items', 'campaign_items has a primary key');
select has_pk('marketing_ops', 'audit_events', 'audit_events has a primary key');
select has_pk('marketing_ops', 'domain_events', 'domain_events has a primary key');
select has_pk('marketing_ops', 'idempotency_records', 'idempotency_records has a primary key');
select has_pk('marketing_ops', 'delegation_uses', 'delegation_uses has a primary key');
select has_pk('marketing_ops', 'schema_versions', 'schema_versions has a primary key');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.tenants')), 'tenants forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.memberships')), 'memberships forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.campaigns')), 'campaigns forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.campaign_members')), 'campaign_members forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.campaign_items')), 'campaign_items forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.audit_events')), 'audit_events forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.domain_events')), 'domain_events forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.idempotency_records')), 'idempotency_records forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.delegation_uses')), 'delegation_uses forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.schema_versions')), 'schema_versions forces RLS');

select ok(not has_table_privilege('anon', 'marketing_ops.tenants', 'SELECT'), 'anon cannot read tenants');
select ok(not has_table_privilege('anon', 'marketing_ops.memberships', 'SELECT'), 'anon cannot read memberships');
select ok(not has_table_privilege('anon', 'marketing_ops.campaigns', 'SELECT'), 'anon cannot read campaigns');
select ok(not has_table_privilege('anon', 'marketing_ops.campaign_members', 'SELECT'), 'anon cannot read campaign members');
select ok(not has_table_privilege('anon', 'marketing_ops.campaign_items', 'SELECT'), 'anon cannot read campaign items');
select ok(not has_table_privilege('anon', 'marketing_ops.audit_events', 'SELECT'), 'anon cannot read audit events');
select ok(not has_table_privilege('anon', 'marketing_ops.domain_events', 'SELECT'), 'anon cannot read domain events');
select ok(not has_table_privilege('anon', 'marketing_ops.idempotency_records', 'SELECT'), 'anon cannot read idempotency records');
select ok(not has_table_privilege('anon', 'marketing_ops.delegation_uses', 'SELECT'), 'anon cannot read delegation uses');
select ok(not has_table_privilege('anon', 'marketing_ops.schema_versions', 'SELECT'), 'anon cannot read schema versions');

select ok(has_table_privilege('authenticated', 'marketing_ops.campaigns', 'SELECT'), 'authenticated has explicit campaign read grant');
select ok(has_table_privilege('authenticated', 'marketing_ops.campaigns', 'INSERT'), 'authenticated has explicit campaign insert grant');
select ok(has_table_privilege('authenticated', 'marketing_ops.campaign_items', 'SELECT'), 'authenticated has explicit item read grant');
select ok(has_table_privilege('authenticated', 'marketing_ops.audit_events', 'INSERT'), 'authenticated has explicit audit insert grant');
select ok(has_table_privilege('service_role', 'marketing_ops.domain_events', 'SELECT,INSERT,UPDATE'), 'service role can operate the outbox');

select ok(to_regclass('marketing_ops.memberships') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.memberships') and contype = 'f'
), 'memberships references auth users or tenants');
select ok(to_regclass('marketing_ops.campaigns') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.campaigns') and conname = 'campaigns_tenant_fk'
), 'campaigns has tenant foreign key');
select ok(to_regclass('marketing_ops.campaigns') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.campaigns') and conname = 'campaigns_created_by_fk'
), 'campaigns has creator foreign key');
select ok(to_regclass('marketing_ops.campaign_members') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.campaign_members') and conname = 'campaign_members_campaign_fk'
), 'campaign members enforce campaign tenant');
select ok(to_regclass('marketing_ops.campaign_items') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.campaign_items') and conname = 'campaign_items_campaign_fk'
), 'campaign items enforce campaign tenant');
select ok(to_regclass('marketing_ops.audit_events') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.audit_events') and conname = 'audit_events_tenant_fk'
), 'audit events have tenant foreign key');
select ok(to_regclass('marketing_ops.idempotency_records') is not null and exists (
  select 1 from pg_constraint
  where conrelid = to_regclass('marketing_ops.idempotency_records') and conname = 'idempotency_records_actor_fk'
), 'idempotency records have actor foreign key');

select ok(exists (select 1 from pg_constraint where conname = 'campaigns_version_positive'), 'campaign versions must be positive');
select ok(exists (select 1 from pg_constraint where conname = 'campaign_items_version_positive'), 'item versions must be positive');
select ok(exists (select 1 from pg_constraint where conname = 'campaigns_archive_consistent'), 'campaign archive state is consistent');
select ok(exists (select 1 from pg_constraint where conname = 'idempotency_records_request_hash_format'), 'request hashes have a fixed format');
select has_column('marketing_ops', 'campaigns', 'course_slug', 'campaigns support course filtering');
select ok(exists (select 1 from pg_constraint where conname = 'campaigns_course_slug_format'), 'course slugs have a constrained format');
select has_index('marketing_ops', 'campaigns', 'campaigns_tenant_course_updated_idx', 'campaign course and period index exists');

select has_index('marketing_ops', 'campaigns', 'campaigns_tenant_status_updated_idx', 'campaign list index exists');
select has_index('marketing_ops', 'campaigns', 'campaigns_tenant_created_by_idx', 'campaign owner index exists');
select has_index('marketing_ops', 'campaign_members', 'campaign_members_tenant_user_idx', 'campaign member RLS index exists');
select has_index('marketing_ops', 'campaign_items', 'campaign_items_tenant_campaign_updated_idx', 'item list index exists');
select has_index('marketing_ops', 'audit_events', 'audit_events_tenant_created_idx', 'audit list index exists');
select has_index('marketing_ops', 'domain_events', 'domain_events_unpublished_idx', 'outbox polling index exists');
select has_index('marketing_ops', 'idempotency_records', 'idempotency_records_expires_idx', 'idempotency expiry index exists');
select has_index('marketing_ops', 'delegation_uses', 'delegation_uses_expires_idx', 'delegation expiry index exists');

select has_function('marketing_ops_private', 'current_tenant_id', array[]::text[], 'current tenant helper exists');
select has_function('marketing_ops_private', 'current_actor_role', array['uuid'], 'current actor role helper exists');
select has_function('marketing_ops_private', 'can_access_campaign', array['uuid'], 'campaign access helper exists');
select ok(not exists (
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = to_regprocedure('marketing_ops_private.current_actor_role(uuid)') and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute current_actor_role');
select ok(not exists (
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = to_regprocedure('marketing_ops_private.can_access_campaign(uuid)') and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute can_access_campaign');

select throws_ok(
  $$update marketing_ops.audit_events set action = 'tampered' where id = 'd1111111-1111-4111-8111-111111111111'$$,
  '55000',
  'audit_events are immutable',
  'audit events cannot be updated'
);
select throws_ok(
  $$delete from marketing_ops.audit_events where id = 'd1111111-1111-4111-8111-111111111111'$$,
  '55000',
  'audit_events are immutable',
  'audit events cannot be deleted'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;
select results_eq($$select count(*)::bigint from marketing_ops.tenants$$, array[1::bigint], 'member sees the selected tenant');
select results_eq($$select count(*)::bigint from marketing_ops.campaigns where id = 'c1111111-1111-4111-8111-111111111111'$$, array[1::bigint], 'member sees a participating campaign');
select results_eq($$select count(*)::bigint from marketing_ops.campaigns where id = 'c2222222-2222-4222-8222-222222222222'$$, array[0::bigint], 'member cannot see an unassigned campaign');
select results_eq($$select count(*)::bigint from marketing_ops.campaigns where id = 'c3333333-3333-4333-8333-333333333333'$$, array[0::bigint], 'member cannot see another tenant campaign');
select results_eq($$select count(*)::bigint from marketing_ops.audit_events$$, array[0::bigint], 'member cannot read audit events');
select is(marketing_ops_private.current_actor_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)::text, 'member', 'member role comes from membership');
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;
select results_eq($$select count(*)::bigint from marketing_ops.campaigns where id in ('c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222')$$, array[2::bigint], 'manager sees all seeded campaigns in the selected tenant');
select results_eq($$select count(*)::bigint from marketing_ops.audit_events where id = 'd1111111-1111-4111-8111-111111111111'$$, array[1::bigint], 'manager can read seeded tenant audit events');
select is(marketing_ops_private.current_actor_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)::text, 'manager', 'manager role comes from membership');
reset role;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;
select results_eq($$select count(*)::bigint from marketing_ops.campaigns where id in ('c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222')$$, array[2::bigint], 'admin sees all seeded campaigns in the selected tenant');
select results_eq($$select count(*)::bigint from marketing_ops.audit_events where id = 'd1111111-1111-4111-8111-111111111111'$$, array[1::bigint], 'admin can read seeded tenant audit events');
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('marketing_ops.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;
select results_eq($$select count(*)::bigint from marketing_ops.campaigns$$, array[0::bigint], 'forged tenant selection grants no campaign access');
select is(marketing_ops_private.current_actor_role('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)::text, null, 'forged tenant has no actor role');
select throws_ok(
  $$insert into marketing_ops.campaigns (tenant_id, name, created_by, updated_by) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'forged', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111')$$,
  '42501',
  null,
  'cross-tenant campaign insert is denied'
);
reset role;

select results_eq(
  $$select count(*)::bigint from marketing_ops.schema_versions where version = '2026-07-phase-1-foundation'$$,
  array[1::bigint],
  'foundation schema version is recorded'
);

select * from finish();

rollback;
