begin;

select plan(20);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.approval_requests')), 'requests force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.approval_decisions')), 'decisions force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('marketing_ops.action_packages')), 'packages force RLS');

select ok(not has_table_privilege('anon', 'marketing_ops.approval_requests', 'SELECT'), 'anon cannot read requests');
select ok(not has_table_privilege('anon', 'marketing_ops.approval_decisions', 'SELECT'), 'anon cannot read decisions');
select ok(not has_table_privilege('anon', 'marketing_ops.action_packages', 'SELECT'), 'anon cannot read packages');

select ok(has_table_privilege('authenticated', 'marketing_ops.approval_requests', 'SELECT'), 'authenticated can read authorized requests');
select ok(has_table_privilege('authenticated', 'marketing_ops.approval_decisions', 'SELECT'), 'authenticated can read authorized decisions');
select ok(has_table_privilege('authenticated', 'marketing_ops.action_packages', 'SELECT'), 'authenticated can read authorized packages');
select ok(not has_table_privilege('authenticated', 'marketing_ops.approval_decisions', 'UPDATE'), 'authenticated cannot update decisions');
select ok(not has_table_privilege('authenticated', 'marketing_ops.approval_decisions', 'DELETE'), 'authenticated cannot delete decisions');
select ok(not has_table_privilege('authenticated', 'marketing_ops.action_packages', 'DELETE'), 'authenticated cannot delete packages');

select is((select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'approval_requests'), 3, 'requests expose select/insert/update policies');
select is((select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'approval_decisions'), 2, 'decisions expose select/insert policies');
select is((select count(*)::integer from pg_policies where schemaname = 'marketing_ops' and tablename = 'action_packages'), 3, 'packages expose select/insert/update policies');

select has_function('marketing_ops_private', 'can_access_approval_request', array['uuid'], 'request access helper exists');
select has_function('marketing_ops_private', 'can_decide_approval_request', array['uuid'], 'request decision helper exists');
select ok((select prosecdef from pg_proc where oid = to_regprocedure('marketing_ops_private.can_access_approval_request(uuid)')), 'access helper is security definer');
select ok((select prosecdef from pg_proc where oid = to_regprocedure('marketing_ops_private.can_decide_approval_request(uuid)')), 'decision helper is security definer');
select ok(not exists (
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid in (
    to_regprocedure('marketing_ops_private.can_access_approval_request(uuid)'),
    to_regprocedure('marketing_ops_private.can_decide_approval_request(uuid)')
  ) and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute approval helpers');

select * from finish();
rollback;
