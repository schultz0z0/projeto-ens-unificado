-- Deterministic local-only fixtures. These IDs are not production identities.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'member@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'manager@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'admin@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'other@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, tenant_id)
values
  ('11111111-1111-4111-8111-111111111111', 'member@local.test', 'Local Member', 'member', 'ens'),
  ('22222222-2222-4222-8222-222222222222', 'manager@local.test', 'Local Manager', 'manager', 'ens'),
  ('33333333-3333-4333-8333-333333333333', 'admin@local.test', 'Local Admin', 'admin', 'ens'),
  ('44444444-4444-4444-8444-444444444444', 'other@local.test', 'Other Tenant Member', 'member', 'other')
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;

insert into marketing_ops.tenants (id, slug, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ens', 'ENS'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'other', 'Other tenant')
on conflict (id) do nothing;

insert into marketing_ops.memberships (tenant_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'manager'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'member')
on conflict (tenant_id, user_id) do nothing;

insert into marketing_ops.campaigns (id, tenant_id, name, created_by, updated_by)
values
  ('c1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Member campaign', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('c2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Manager campaign', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222'),
  ('c3333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other campaign', '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444')
on conflict (id) do nothing;

insert into marketing_ops.campaign_members (tenant_id, campaign_id, user_id, member_role, created_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'owner', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'owner', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c3333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 'owner', '44444444-4444-4444-8444-444444444444')
on conflict (campaign_id, user_id) do nothing;

insert into marketing_ops.audit_events (
  id, tenant_id, actor_user_id, actor_role, actor_type, origin,
  entity_type, entity_id, action, after_state, correlation_id
)
values (
  'd1111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  'manager', 'user', 'internal', 'campaign',
  'c2222222-2222-4222-8222-222222222222', 'seeded',
  '{"status":"draft"}', 'e1111111-1111-4111-8111-111111111111'
)
on conflict (id) do nothing;
