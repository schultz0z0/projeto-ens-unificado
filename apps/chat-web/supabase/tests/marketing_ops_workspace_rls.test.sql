begin;

select plan(35);

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
  ('00000000-0000-0000-0000-000000000000', '12121212-1212-4121-8121-121212121212', 'authenticated', 'authenticated', 'editor-candidate-rls@local.test', crypt('local-test-password', gen_salt('bf')), now(), '', '', '', '', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now());

insert into marketing_ops.memberships (tenant_id, user_id, role, active)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '66666666-6666-4666-8666-666666666666', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '88888888-8888-4888-8888-888888888888', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '99999999-9999-4999-8999-999999999999', 'member', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '12121212-1212-4121-8121-121212121212', 'member', true);

insert into marketing_ops.campaign_members (
  tenant_id, campaign_id, user_id, member_role, is_primary, created_by
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'editor', false, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'viewer', false, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'owner', false, '11111111-1111-4111-8111-111111111111');

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
    select count(*) = 5
    from pg_proc as function_meta
    join pg_namespace as function_schema on function_schema.oid = function_meta.pronamespace
    where function_schema.nspname = 'marketing_ops_private'
      and function_meta.proname = any (array[
        'can_manage_campaign', 'can_bootstrap_campaign_owner', 'can_administer_campaign_participants',
        'promote_first_campaign_owner', 'assert_campaign_primary_owner'
      ])
      and function_meta.prosecdef
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
        (function_meta.proname in ('can_manage_campaign', 'can_bootstrap_campaign_owner', 'can_administer_campaign_participants')
          and has_function_privilege('authenticated', function_meta.oid, 'EXECUTE'))
        or
        (function_meta.proname in ('promote_first_campaign_owner', 'assert_campaign_primary_owner')
          and not has_function_privilege('authenticated', function_meta.oid, 'EXECUTE'))
      )
  ),
  'participant helpers and trigger functions have private schemas, fixed paths, and minimal ACLs'
);

select * from finish();

rollback;
