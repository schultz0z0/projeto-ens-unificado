begin;

select plan(68);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'editor-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'viewer-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'candidate-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '88888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', 'owner-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '99999999-9999-4999-8999-999999999999', 'authenticated', 'authenticated', 'admin-candidate-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '12121212-1212-4121-8121-121212121212', 'authenticated', 'authenticated', 'editor-candidate-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '13131313-1313-4131-8131-131313131313', 'authenticated', 'authenticated', 'inactive-editor-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '14141414-1414-4141-8141-141414141414', 'authenticated', 'authenticated', 'archived-candidate-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now());

insert into marketing_ops.memberships (tenant_id, user_id, role, active)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '66666666-6666-4666-8666-666666666666', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '88888888-8888-4888-8888-888888888888', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '99999999-9999-4999-8999-999999999999', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '12121212-1212-4121-8121-121212121212', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '13131313-1313-4131-8131-131313131313', 'member', false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '14141414-1414-4141-8141-141414141414', 'member', true);

insert into marketing_ops.campaign_members (
  tenant_id, campaign_id, user_id, member_role, is_primary, created_by
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'editor', false, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'viewer', false, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'owner', false, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '13131313-1313-4131-8131-131313131313', 'editor', false, '11111111-1111-4111-8111-111111111111');

update marketing_ops.campaigns
set reference_document_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    reference_verified_at = now()
where id = 'c1111111-1111-4111-8111-111111111111';

do $setup$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_materials'
      and column_name = 'artifact_owner_id'
  ) then
    execute $sql$
      insert into marketing_ops.campaign_materials (
        id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
        content_type, size_bytes, sha256, source, created_by
      ) values (
        'f1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111',
        'artifact-owner-111', 'base.pdf', 'application/pdf', 100, repeat('a', 64), 'upload',
        '11111111-1111-4111-8111-111111111111'
      )
    $sql$;
  else
    insert into marketing_ops.campaign_materials (
      id, tenant_id, campaign_id, artifact_id, filename,
      content_type, size_bytes, sha256, source, created_by
    ) values (
      'f1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111',
      'base.pdf', 'application/pdf', 100, repeat('a', 64), 'upload',
      '11111111-1111-4111-8111-111111111111'
    );
  end if;
end
$setup$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select throws_ok(
  $$
    do $probe$
    begin
      insert into marketing_ops.campaigns (
        id, tenant_id, name, course_slug, version, created_by, updated_by, created_at, updated_at
      ) values (
        'cb999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Mass assignment probe', null, 999,
        '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
        '2001-01-01 00:00:00+00', '2001-01-01 00:00:00+00'
      );
      raise exception using errcode = 'P0001', message = 'campaign INSERT accepted protected columns';
    end
    $probe$
  $$,
  '42501',
  null,
  'campaign INSERT rejects caller-controlled version and timestamps'
);

select lives_ok(
  $test$
    do $writer$
    begin
      insert into marketing_ops.campaigns (
        id, tenant_id, name, course_slug, created_by, updated_by
      ) values (
        'ca111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Legacy writer campaign', null, '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111'
      );
      insert into marketing_ops.campaign_members (
        tenant_id, campaign_id, user_id, member_role, created_by
      ) values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111', 'owner',
        '11111111-1111-4111-8111-111111111111'
      );
      execute 'set constraints all immediate';
      if not exists (
        select 1 from marketing_ops.campaign_members
        where campaign_id = 'ca111111-1111-4111-8111-111111111111'
          and user_id = '11111111-1111-4111-8111-111111111111'
          and member_role = 'owner'
          and is_primary
      ) then
        raise exception 'legacy writer owner was not promoted';
      end if;
      execute 'set constraints all deferred';
    end
    $writer$
  $test$,
  'the F1 writer creates a draft with an automatically promoted primary owner'
);

select lives_ok(
  $test$
    do $writer$
    begin
      insert into marketing_ops.campaigns (
        id, tenant_id, name, course_slug, objective, reference_type, reference_key,
        reference_title_snapshot, reference_document_id, reference_verified_at,
        audience, starts_on, ends_on, primary_channel, secondary_channels,
        briefing, notes, created_by, updated_by
      ) values (
        'cb222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Progressive draft campaign', 'progressive-course', 'Exercise the progressive draft contract',
        'course', 'progressive-course', 'Progressive course',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', now(), 'Prospective students',
        current_date + 7, current_date + 14, 'email',
        array['instagram']::marketing_ops.campaign_channel[], 'Progressive briefing',
        'Progressive notes', '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111'
      );
      insert into marketing_ops.campaign_members (
        tenant_id, campaign_id, user_id, member_role, created_by
      ) values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cb222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111', 'owner',
        '11111111-1111-4111-8111-111111111111'
      );
      execute 'set constraints all immediate';
      execute 'set constraints all deferred';
    end
    $writer$
  $test$,
  'authenticated writer creates a progressive draft through the exact INSERT surface'
);

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where id = 'f1111111-1111-4111-8111-111111111111'$$,
  array[1::bigint],
  'primary owner reads campaign material'
);

select lives_ok(
  $test$
    do $material$
    begin
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'marketing_ops' and table_name = 'campaign_materials' and column_name = 'artifact_owner_id'
      ) then
        execute $sql$
          insert into marketing_ops.campaign_materials (
            id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
            content_type, size_bytes, sha256, source, created_by
          ) values (
            'f2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'c1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222',
            'artifact-owner-111', 'owner.pdf', 'application/pdf', 100, repeat('b', 64), 'upload',
            '11111111-1111-4111-8111-111111111111'
          )
        $sql$;
      else
        insert into marketing_ops.campaign_materials (
          id, tenant_id, campaign_id, artifact_id, filename,
          content_type, size_bytes, sha256, source, created_by
        ) values (
          'f2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'c1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222',
          'owner.pdf', 'application/pdf', 100, repeat('b', 64), 'upload',
          '11111111-1111-4111-8111-111111111111'
        );
      end if;
    end
    $material$
  $test$,
  'primary owner links own upload metadata'
);

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaign_materials
      set unlinked_by = '11111111-1111-4111-8111-111111111111', unlinked_at = now()
      where id = 'f2222222-2222-4222-8222-222222222222'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[1::bigint],
  'primary owner unlinks campaign material'
);

select lives_ok(
  $$
    insert into marketing_ops.campaign_members (
      tenant_id, campaign_id, user_id, member_role, created_by
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
      '77777777-7777-4777-8777-777777777777', 'viewer', '11111111-1111-4111-8111-111111111111'
    )
  $$,
  'member primary owner adds a viewer'
);

select lives_ok(
  $$
    insert into marketing_ops.campaign_members (
      tenant_id, campaign_id, user_id, member_role, created_by
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
      '12121212-1212-4121-8121-121212121212', 'editor', '11111111-1111-4111-8111-111111111111'
    )
  $$,
  'member primary owner adds an editor'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        insert into marketing_ops.campaign_members (
          tenant_id, campaign_id, user_id, member_role, created_by
        ) values (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
          '99999999-9999-4999-8999-999999999999', 'owner', '11111111-1111-4111-8111-111111111111'
        );
        raise exception 'member primary owner added an owner';
      exception when insufficient_privilege then
        null;
      end;
    end
    $denied$
  $test$,
  'member primary owner cannot add owners'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaign_members
      set member_role = 'editor', is_primary = false
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '88888888-8888-4888-8888-888888888888';
      if found then raise exception 'member primary owner altered an owner'; end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'member primary owner cannot alter owners or primary flags'
);

select lives_ok(
  $test$
    do $denied$
    begin
      delete from marketing_ops.campaign_members
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '88888888-8888-4888-8888-888888888888';
      if found then raise exception 'member primary owner removed an owner'; end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'member primary owner cannot remove owners'
);

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaign_members
      set member_role = 'editor'
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '77777777-7777-4777-8777-777777777777'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[1::bigint],
  'member primary owner updates viewer/editor roles'
);

select results_eq(
  $$
    with changed as (
      delete from marketing_ops.campaign_members
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '77777777-7777-4777-8777-777777777777'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[1::bigint],
  'member primary owner removes viewers/editors'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where campaign_id = 'c1111111-1111-4111-8111-111111111111'$$,
  array[2::bigint],
  'manager reads tenant campaign materials'
);

select lives_ok(
  $$
    insert into marketing_ops.campaign_members (
      tenant_id, campaign_id, user_id, member_role, is_primary, created_by
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
      '99999999-9999-4999-8999-999999999999', 'owner', false, '22222222-2222-4222-8222-222222222222'
    )
  $$,
  'manager adds a secondary owner'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        update marketing_ops.campaign_members
        set is_primary = false
        where campaign_id = 'c1111111-1111-4111-8111-111111111111'
          and user_id = '11111111-1111-4111-8111-111111111111';
        execute 'set constraints all immediate';
        raise exception 'last primary owner was demoted';
      exception when check_violation then
        execute 'set constraints all deferred';
      end;
    end
    $denied$
  $test$,
  'deferred cardinality rejects demoting the last primary owner'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        delete from marketing_ops.campaign_members
        where campaign_id = 'c1111111-1111-4111-8111-111111111111'
          and user_id = '11111111-1111-4111-8111-111111111111';
        execute 'set constraints all immediate';
        raise exception 'last primary owner was removed';
      exception when check_violation then
        execute 'set constraints all deferred';
      end;
    end
    $denied$
  $test$,
  'deferred cardinality rejects removing the last primary owner'
);

select lives_ok(
  $test$
    do $transfer$
    begin
      update marketing_ops.campaign_members
      set is_primary = false
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '11111111-1111-4111-8111-111111111111';
      update marketing_ops.campaign_members
      set is_primary = true
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '88888888-8888-4888-8888-888888888888';
      execute 'set constraints all immediate';
      execute 'set constraints all deferred';
    end
    $transfer$
  $test$,
  'manager transfers primary ownership atomically'
);

select results_eq(
  $$
    select count(*)::bigint
    from marketing_ops.campaign_members
    where campaign_id = 'c1111111-1111-4111-8111-111111111111' and is_primary
  $$,
  array[1::bigint],
  'atomic transfer leaves exactly one primary owner'
);

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaign_members
      set member_role = 'editor', is_primary = false
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '11111111-1111-4111-8111-111111111111'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[1::bigint],
  'manager can reclassify the former primary owner'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where id = 'f1111111-1111-4111-8111-111111111111'$$,
  array[1::bigint],
  'former primary creator keeps editor read access'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        insert into marketing_ops.campaign_members (
          tenant_id, campaign_id, user_id, member_role, created_by
        ) values (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
          '77777777-7777-4777-8777-777777777777', 'viewer', '11111111-1111-4111-8111-111111111111'
        );
        raise exception 'reclassified creator added a participant';
      exception when insufficient_privilege then null;
      end;
    end
    $denied$
  $test$,
  'reclassified creator cannot add participants'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaign_members
      set member_role = 'viewer'
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '12121212-1212-4121-8121-121212121212';
      if found then raise exception 'reclassified creator updated a participant'; end if;
    exception when insufficient_privilege then null;
    end
    $denied$
  $test$,
  'reclassified creator cannot update participants'
);

select lives_ok(
  $test$
    do $denied$
    begin
      delete from marketing_ops.campaign_members
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '12121212-1212-4121-8121-121212121212';
      if found then raise exception 'reclassified creator removed a participant'; end if;
    exception when insufficient_privilege then null;
    end
    $denied$
  $test$,
  'reclassified creator cannot remove participants'
);

reset role;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where id = 'f1111111-1111-4111-8111-111111111111'$$,
  array[1::bigint],
  'editor reads campaign material'
);

select lives_ok(
  $test$
    do $material$
    begin
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'marketing_ops' and table_name = 'campaign_materials' and column_name = 'artifact_owner_id'
      ) then
        execute $sql$
          insert into marketing_ops.campaign_materials (
            id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
            content_type, size_bytes, sha256, source, created_by
          ) values (
            'f3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'c1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333',
            'artifact-owner-555', 'editor.pdf', 'application/pdf', 100, repeat('c', 64), 'upload',
            '55555555-5555-4555-8555-555555555555'
          )
        $sql$;
      else
        insert into marketing_ops.campaign_materials (
          id, tenant_id, campaign_id, artifact_id, filename,
          content_type, size_bytes, sha256, source, created_by
        ) values (
          'f3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'c1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333',
          'editor.pdf', 'application/pdf', 100, repeat('c', 64), 'upload',
          '55555555-5555-4555-8555-555555555555'
        );
      end if;
    end
    $material$
  $test$,
  'editor links own upload metadata'
);

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaign_materials
      set unlinked_by = '55555555-5555-4555-8555-555555555555', unlinked_at = now()
      where id = 'f3333333-3333-4333-8333-333333333333'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[1::bigint],
  'editor unlinks campaign material'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        insert into marketing_ops.campaign_members (
          tenant_id, campaign_id, user_id, member_role, created_by
        ) values (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
          '77777777-7777-4777-8777-777777777777', 'viewer', '55555555-5555-4555-8555-555555555555'
        );
        raise exception 'editor managed participants';
      exception when insufficient_privilege then null;
      end;
    end
    $denied$
  $test$,
  'editor cannot manage participants'
);

reset role;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where id = 'f1111111-1111-4111-8111-111111111111'$$,
  array[1::bigint],
  'viewer reads campaign material'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        if exists (
          select 1 from information_schema.columns
          where table_schema = 'marketing_ops' and table_name = 'campaign_materials' and column_name = 'artifact_owner_id'
        ) then
          execute $sql$
            insert into marketing_ops.campaign_materials (
              id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
              content_type, size_bytes, sha256, source, created_by
            ) values (
              'f4444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              'c1111111-1111-4111-8111-111111111111', 'a4444444-4444-4444-8444-444444444444',
              'artifact-owner-666', 'viewer.pdf', 'application/pdf', 100, repeat('d', 64), 'upload',
              '66666666-6666-4666-8666-666666666666'
            )
          $sql$;
        else
          insert into marketing_ops.campaign_materials (
            id, tenant_id, campaign_id, artifact_id, filename,
            content_type, size_bytes, sha256, source, created_by
          ) values (
            'f4444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'c1111111-1111-4111-8111-111111111111', 'a4444444-4444-4444-8444-444444444444',
            'viewer.pdf', 'application/pdf', 100, repeat('d', 64), 'upload',
            '66666666-6666-4666-8666-666666666666'
          );
        end if;
        raise exception 'viewer linked a material';
      exception when insufficient_privilege then null;
      end;
    end
    $denied$
  $test$,
  'viewer cannot link campaign material'
);

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaign_materials
      set unlinked_by = '66666666-6666-4666-8666-666666666666', unlinked_at = now()
      where id = 'f1111111-1111-4111-8111-111111111111'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[0::bigint],
  'viewer cannot unlink campaign material'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        insert into marketing_ops.campaign_members (
          tenant_id, campaign_id, user_id, member_role, created_by
        ) values (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
          '77777777-7777-4777-8777-777777777777', 'viewer', '66666666-6666-4666-8666-666666666666'
        );
        raise exception 'viewer managed participants';
      exception when insufficient_privilege then null;
      end;
    end
    $denied$
  $test$,
  'viewer cannot manage participants'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('marketing_ops.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where campaign_id = 'c1111111-1111-4111-8111-111111111111'$$,
  array[0::bigint],
  'cross-tenant actor cannot read materials'
);

select lives_ok(
  $test$
    do $denied$
    begin
      begin
        if exists (
          select 1 from information_schema.columns
          where table_schema = 'marketing_ops' and table_name = 'campaign_materials' and column_name = 'artifact_owner_id'
        ) then
          execute $sql$
            insert into marketing_ops.campaign_materials (
              id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
              content_type, size_bytes, sha256, source, created_by
            ) values (
              'f5555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              'c1111111-1111-4111-8111-111111111111', 'a5555555-5555-4555-8555-555555555555',
              'artifact-owner-444', 'cross.pdf', 'application/pdf', 100, repeat('e', 64), 'upload',
              '44444444-4444-4444-8444-444444444444'
            )
          $sql$;
        else
          insert into marketing_ops.campaign_materials (
            id, tenant_id, campaign_id, artifact_id, filename,
            content_type, size_bytes, sha256, source, created_by
          ) values (
            'f5555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            'c1111111-1111-4111-8111-111111111111', 'a5555555-5555-4555-8555-555555555555',
            'cross.pdf', 'application/pdf', 100, repeat('e', 64), 'upload',
            '44444444-4444-4444-8444-444444444444'
          );
        end if;
        raise exception 'cross-tenant actor linked material';
      exception when insufficient_privilege then null;
      end;
    end
    $denied$
  $test$,
  'cross-tenant actor cannot link material'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select lives_ok(
  $$
    insert into marketing_ops.campaign_members (
      tenant_id, campaign_id, user_id, member_role, is_primary, created_by
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
      '77777777-7777-4777-8777-777777777777', 'owner', false, '33333333-3333-4333-8333-333333333333'
    )
  $$,
  'admin adds an owner'
);

select lives_ok(
  $test$
    do $transfer$
    begin
      update marketing_ops.campaign_members
      set is_primary = false
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '88888888-8888-4888-8888-888888888888';
      update marketing_ops.campaign_members
      set is_primary = true
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '77777777-7777-4777-8777-777777777777';
      execute 'set constraints all immediate';
      execute 'set constraints all deferred';
    end
    $transfer$
  $test$,
  'admin transfers primary ownership'
);

reset role;

select ok(
  (
    select count(*) = 8
    from pg_proc as function_meta
    join pg_namespace as function_schema on function_schema.oid = function_meta.pronamespace
    where function_schema.nspname = 'marketing_ops_private'
      and function_meta.proname = any (array[
        'can_edit_campaign', 'can_manage_campaign', 'can_bootstrap_campaign_owner',
        'can_administer_campaign_participants', 'lock_campaign_aggregate',
        'promote_first_campaign_owner', 'assert_campaign_primary_owner', 'enforce_campaign_update'
      ])
      and function_meta.prosecdef
      and function_meta.provolatile = 'v'
      and function_meta.proconfig @> array['search_path=""']::text[]
      and not exists (
        select 1
        from aclexplode(coalesce(
          function_meta.proacl,
          acldefault('f', function_meta.proowner)
        )) as function_acl
        where function_acl.grantee = 0
          and function_acl.privilege_type = 'EXECUTE'
      )
      and not has_function_privilege('anon', function_meta.oid, 'EXECUTE')
      and not has_function_privilege('service_role', function_meta.oid, 'EXECUTE')
      and (
        (function_meta.proname in ('can_edit_campaign', 'can_manage_campaign', 'can_bootstrap_campaign_owner', 'can_administer_campaign_participants')
          and has_function_privilege('authenticated', function_meta.oid, 'EXECUTE'))
        or
        (function_meta.proname in ('lock_campaign_aggregate', 'promote_first_campaign_owner', 'assert_campaign_primary_owner', 'enforce_campaign_update')
          and not has_function_privilege('authenticated', function_meta.oid, 'EXECUTE'))
      )
  ),
  'participant helpers and trigger functions have private schemas, fixed paths, and minimal ACLs'
);

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set name = 'Viewer bypass', version = version + 1,
          updated_by = '66666666-6666-4666-8666-666666666666'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'viewer edited campaign fields';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'viewer cannot edit campaign fields'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set status = 'planned', version = version + 1,
          updated_by = '66666666-6666-4666-8666-666666666666'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'viewer changed campaign status';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'viewer cannot change campaign status'
);

reset role;
select set_config('request.jwt.claim.sub', '13131313-1313-4131-8131-131313131313', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from marketing_ops.campaign_materials where id = 'f1111111-1111-4111-8111-111111111111'$$,
  array[0::bigint],
  'inactive participant cannot read campaign material'
);

select lives_ok(
  $test$
    do $denied$
    begin
      insert into marketing_ops.campaign_materials (
        id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
        content_type, size_bytes, sha256, source, created_by
      ) values (
        'f6666666-6666-4666-8666-666666666666', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'c1111111-1111-4111-8111-111111111111', 'a6666666-6666-4666-8666-666666666666',
        'artifact-owner-inactive', 'inactive.pdf', 'application/pdf', 100,
        repeat('f', 64), 'upload', '13131313-1313-4131-8131-131313131313'
      );
      raise exception using errcode = 'P0001', message = 'inactive participant linked material';
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'inactive participant cannot link campaign material'
);

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaign_materials
      set unlinked_by = '13131313-1313-4131-8131-131313131313', unlinked_at = now()
      where id = 'f1111111-1111-4111-8111-111111111111'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[0::bigint],
  'inactive participant cannot unlink campaign material'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('marketing_ops.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set name = 'Cross tenant bypass', version = version + 1,
          updated_by = '44444444-4444-4444-8444-444444444444'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning 1
    ) select count(*)::bigint from changed
  $$,
  array[0::bigint],
  'cross-tenant actor cannot update campaign'
);

reset role;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set name = 'Editor field update', version = version + 1,
          updated_by = '55555555-5555-4555-8555-555555555555'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning name
    ) select name from changed
  $$,
  $$values ('Editor field update'::text)$$,
  'active editor can edit campaign fields'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set notes = 'version bypass',
          updated_by = '55555555-5555-4555-8555-555555555555'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'campaign updated without version increment';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'authenticated campaign updates require version plus one'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set status = 'planned', version = version + 1,
          updated_by = '55555555-5555-4555-8555-555555555555'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'editor changed campaign status';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'editor cannot change campaign status'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set created_by = '55555555-5555-4555-8555-555555555555',
          version = version + 1,
          updated_by = '55555555-5555-4555-8555-555555555555'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'editor changed immutable campaign identity';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'campaign immutable columns reject mass assignment'
);

reset role;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set audience = 'Secondary owner audience', version = version + 1,
          updated_by = '99999999-9999-4999-8999-999999999999'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning audience
    ) select audience from changed
  $$,
  $$values ('Secondary owner audience'::text)$$,
  'active secondary owner can edit campaign fields'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set status = 'planned', version = version + 1,
          updated_by = '99999999-9999-4999-8999-999999999999'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'secondary owner changed campaign status';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'secondary owner cannot change campaign status'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaign_members
      set created_by = '33333333-3333-4333-8333-333333333333'
      where campaign_id = 'c1111111-1111-4111-8111-111111111111'
        and user_id = '99999999-9999-4999-8999-999999999999';
      if found then
        raise exception using errcode = 'P0001', message = 'manager changed immutable participant metadata';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'campaign member immutable columns reject mass assignment'
);

reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set status = 'planned', version = version + 1,
          updated_by = '77777777-7777-4777-8777-777777777777'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning status::text
    ) select status from changed
  $$,
  $$values ('planned'::text)$$,
  'primary owner can advance campaign status'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set status = 'draft', version = version + 1,
          updated_by = '77777777-7777-4777-8777-777777777777'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'primary owner reopened campaign';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'primary owner cannot reopen campaign status'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set status = 'archived', archived_at = now(), version = version + 1,
          updated_by = '77777777-7777-4777-8777-777777777777'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'primary owner archived campaign';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'primary owner cannot archive campaign'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set status = 'draft', version = version + 1,
          updated_by = '22222222-2222-4222-8222-222222222222'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning status::text
    ) select status from changed
  $$,
  $$values ('draft'::text)$$,
  'manager can reopen campaign status'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set status = 'active', version = version + 1,
          updated_by = '22222222-2222-4222-8222-222222222222'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'manager skipped campaign state';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'manager cannot skip campaign states'
);

reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set status = 'planned', version = version + 1,
          updated_by = '77777777-7777-4777-8777-777777777777'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning status::text
    ) select status from changed
  $$,
  $$values ('planned'::text)$$,
  'primary owner can advance campaign again after manager reopen'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set status = 'draft', version = version + 1,
          updated_by = '33333333-3333-4333-8333-333333333333'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning status::text
    ) select status from changed
  $$,
  $$values ('draft'::text)$$,
  'admin can reopen campaign status'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set status = 'archived', archived_at = now(), version = version + 1,
          updated_by = '22222222-2222-4222-8222-222222222222'
      where id = 'c1111111-1111-4111-8111-111111111111'
      returning status::text
    ) select status from changed
  $$,
  $$values ('archived'::text)$$,
  'manager can archive any nonarchived campaign'
);

select lives_ok(
  $test$
    do $denied$
    begin
      update marketing_ops.campaigns
      set notes = 'archived bypass', version = version + 1,
          updated_by = '22222222-2222-4222-8222-222222222222'
      where id = 'c1111111-1111-4111-8111-111111111111';
      if found then
        raise exception using errcode = 'P0001', message = 'archived campaign was edited';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'archived campaign is read-only'
);

select lives_ok(
  $test$
    do $denied$
    begin
      insert into marketing_ops.campaign_members (
        tenant_id, campaign_id, user_id, member_role, is_primary, created_by
      ) values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
        '14141414-1414-4141-8141-141414141414', 'viewer', false,
        '22222222-2222-4222-8222-222222222222'
      );
      raise exception using errcode = 'P0001', message = 'archived participant list was changed';
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'archived campaign rejects participant mutations'
);

select lives_ok(
  $test$
    do $denied$
    begin
      insert into marketing_ops.campaign_materials (
        id, tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
        content_type, size_bytes, sha256, source, created_by
      ) values (
        'f7777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'c1111111-1111-4111-8111-111111111111', 'a7777777-7777-4777-8777-777777777777',
        'artifact-owner-archived', 'archived.pdf', 'application/pdf', 100,
        repeat('7', 64), 'upload', '22222222-2222-4222-8222-222222222222'
      );
      raise exception using errcode = 'P0001', message = 'archived campaign accepted material';
    exception when insufficient_privilege then
      null;
    end
    $denied$
  $test$,
  'archived campaign rejects material links'
);

select is(
  (
    select
      marketing_ops_private.can_edit_campaign('c1111111-1111-4111-8111-111111111111')::text || ',' ||
      marketing_ops_private.can_manage_campaign('c1111111-1111-4111-8111-111111111111')::text || ',' ||
      marketing_ops_private.can_administer_campaign_participants('c1111111-1111-4111-8111-111111111111')::text
  ),
  'false,false,false',
  'archived campaign mutation helpers fail closed'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('marketing_ops.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update marketing_ops.campaigns
      set status = 'archived', archived_at = now(), version = version + 1,
          updated_by = '33333333-3333-4333-8333-333333333333'
      where id = 'c2222222-2222-4222-8222-222222222222'
      returning status::text
    ) select status from changed
  $$,
  $$values ('archived'::text)$$,
  'admin can archive any nonarchived campaign'
);

select lives_ok(
  $test$
    do $probe$
    declare
      locks_before integer;
      locks_after integer;
    begin
      select count(*)::integer
      into locks_before
      from pg_locks
      where pid = pg_backend_pid()
        and locktype = 'advisory';

      perform marketing_ops_private.can_edit_campaign('ffffffff-ffff-4fff-8fff-ffffffffffff');

      select count(*)::integer
      into locks_after
      from pg_locks
      where pid = pg_backend_pid()
        and locktype = 'advisory';

      if locks_after <> locks_before then
        raise exception using errcode = 'P0001', message = 'unauthorized UUID consumed an aggregate lock';
      end if;
    end
    $probe$
  $test$,
  'authorization helpers do not lock nonexistent campaign UUIDs'
);

reset role;

select is(
  (
    select string_agg(distinct column_name, ',' order by column_name)
    from information_schema.column_privileges
    where table_schema = 'marketing_ops'
      and table_name = 'campaigns'
      and grantee = 'authenticated'
      and privilege_type = 'INSERT'
  ),
  'audience,briefing,course_slug,created_by,ends_on,id,name,notes,objective,primary_channel,reference_document_id,reference_key,reference_title_snapshot,reference_type,reference_verified_at,secondary_channels,starts_on,tenant_id,updated_by',
  'campaign INSERT grants expose only progressive draft columns'
);

select is(
  (
    select string_agg(distinct column_name, ',' order by column_name)
    from information_schema.column_privileges
    where table_schema = 'marketing_ops'
      and table_name = 'campaigns'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ),
  'archived_at,audience,briefing,course_slug,ends_on,name,notes,objective,primary_channel,reference_document_id,reference_key,reference_title_snapshot,reference_type,reference_verified_at,secondary_channels,starts_on,status,updated_by,version',
  'campaign UPDATE grants expose only operational columns'
);

select is(
  (
    select string_agg(distinct column_name, ',' order by column_name)
    from information_schema.column_privileges
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_members'
      and grantee = 'authenticated'
      and privilege_type = 'INSERT'
  ),
  'campaign_id,created_by,is_primary,member_role,tenant_id,user_id',
  'campaign member INSERT grants expose only writer columns'
);

select ok(
  (
    select string_agg(distinct column_name, ',' order by column_name)
    from information_schema.column_privileges
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_members'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ) = 'is_primary,member_role'
  and has_table_privilege('authenticated', 'marketing_ops.campaign_members', 'SELECT')
  and has_table_privilege('authenticated', 'marketing_ops.campaign_members', 'DELETE'),
  'campaign member UPDATE is column-scoped while SELECT and DELETE remain available'
);

select * from finish();

rollback;
