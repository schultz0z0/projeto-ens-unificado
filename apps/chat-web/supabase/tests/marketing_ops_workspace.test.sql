begin;

select plan(33);

select is(
  (
    select string_agg(enum_value.enumlabel::text, ',' order by enum_value.enumsortorder)
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'marketing_ops'
      and enum_type.typname = 'campaign_status'
  ),
  'draft,planned,active,completed,archived',
  'campaign status exposes the approved lifecycle'
);

select is(
  (
    select string_agg(enum_value.enumlabel::text, ',' order by enum_value.enumsortorder)
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'marketing_ops'
      and enum_type.typname = 'reference_type'
  ),
  'course,product,initiative',
  'reference type exposes the approved values'
);

select is(
  (
    select string_agg(enum_value.enumlabel::text, ',' order by enum_value.enumsortorder)
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'marketing_ops'
      and enum_type.typname = 'campaign_channel'
  ),
  'email,instagram,linkedin,facebook,whatsapp,website,paid_media,events,press,other',
  'campaign channel matches the approved design exactly'
);

select is(
  (
    select string_agg(enum_value.enumlabel::text, ',' order by enum_value.enumsortorder)
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'marketing_ops'
      and enum_type.typname = 'campaign_material_source'
  ),
  'upload,existing_artifact',
  'material source is a closed enum'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaigns'
      and column_name = any (array[
        'objective', 'reference_type', 'reference_key', 'reference_title_snapshot',
        'reference_document_id', 'reference_verified_at', 'audience', 'starts_on',
        'ends_on', 'primary_channel', 'secondary_channels', 'briefing', 'notes', 'search_vector'
      ])
  ),
  14,
  'campaigns expose all approved workspace columns'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaigns'
      and column_name = any (array['start_date', 'end_date', 'channels'])
  ),
  0,
  'superseded campaign columns are absent before remote deployment'
);

select has_column('marketing_ops', 'campaigns', 'course_slug', 'legacy course slug remains available');

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_materials'
      and column_name = 'artifact_owner_id'
      and data_type = 'text'
      and is_nullable = 'NO'
  ),
  'materials retain the Artifact Server owner'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_materials'
      and column_name = 'source'
      and data_type = 'USER-DEFINED'
      and udt_schema = 'marketing_ops'
      and udt_name = 'campaign_material_source'
      and is_nullable = 'NO'
      and column_default is null
  ),
  'material source is required without a misleading default'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'marketing_ops'
      and table_name = 'campaign_members'
      and column_name = 'is_primary'
      and data_type = 'boolean'
      and is_nullable = 'NO'
      and column_default = 'false'
  ),
  'campaign primary ownership has a migration-first compatible default'
);

select is(
  (
    select count(*)::integer
    from pg_constraint as constraint_meta
    where (
      constraint_meta.conrelid = 'marketing_ops.campaigns'::regclass
      and constraint_meta.conname = any (array[
        'campaigns_name_length', 'campaigns_objective_length', 'campaigns_reference_key_length',
        'campaigns_reference_title_length', 'campaigns_audience_length', 'campaigns_briefing_length',
        'campaigns_notes_length', 'campaigns_channels_consistent', 'campaigns_period_valid',
        'campaigns_reference_consistent', 'campaigns_planning_fields_required'
      ])
    ) or (
      constraint_meta.conrelid = 'marketing_ops.campaign_members'::regclass
      and constraint_meta.conname = 'campaign_members_primary_owner'
    ) or (
      constraint_meta.conrelid = to_regclass('marketing_ops.campaign_materials')
      and constraint_meta.conname = any (array[
        'campaign_materials_artifact_owner', 'campaign_materials_size',
        'campaign_materials_sha256', 'campaign_materials_unlink_consistent'
      ])
    )
  ),
  16,
  'workspace constraints are attached to the intended tables'
);

select ok(
  exists (
    select 1
    from pg_proc as function_meta
    join pg_namespace as function_schema on function_schema.oid = function_meta.pronamespace
    where function_schema.nspname = 'marketing_ops_private'
      and function_meta.oid = to_regprocedure(
        'marketing_ops_private.campaign_channels_are_valid(marketing_ops.campaign_channel,marketing_ops.campaign_channel[])'
      )
      and function_meta.provolatile = 'i'
      and not function_meta.prosecdef
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
      and has_function_privilege('authenticated', function_meta.oid, 'EXECUTE')
      and has_function_privilege('service_role', function_meta.oid, 'EXECUTE')
  ),
  'channel validation helper is immutable, private, and minimally executable'
);

select throws_ok(
  $$update marketing_ops.campaigns set secondary_channels = array['email', 'email']::marketing_ops.campaign_channel[] where id = 'c2222222-2222-4222-8222-222222222222'$$,
  '23514',
  null,
  'secondary channels reject duplicates'
);

select throws_ok(
  $$update marketing_ops.campaigns set primary_channel = 'email', secondary_channels = array['email']::marketing_ops.campaign_channel[] where id = 'c2222222-2222-4222-8222-222222222222'$$,
  '23514',
  null,
  'secondary channels cannot repeat the primary channel'
);

select throws_ok(
  $$update marketing_ops.campaigns set primary_channel = null, secondary_channels = enum_range(null::marketing_ops.campaign_channel) where id = 'c2222222-2222-4222-8222-222222222222'$$,
  '23514',
  null,
  'secondary channels are limited to nine values'
);

select lives_ok(
  $$update marketing_ops.campaigns set primary_channel = 'website', secondary_channels = array['email', 'instagram']::marketing_ops.campaign_channel[] where id = 'c2222222-2222-4222-8222-222222222222'$$,
  'a valid primary and secondary channel set is accepted'
);

select ok(
  exists (
    select 1
    from pg_constraint as constraint_meta
    where constraint_meta.conrelid = 'marketing_ops.campaigns'::regclass
      and constraint_meta.conname = 'campaigns_planning_fields_required'
      and pg_get_constraintdef(constraint_meta.oid) like '%starts_on%'
      and pg_get_constraintdef(constraint_meta.oid) like '%ends_on%'
      and pg_get_constraintdef(constraint_meta.oid) like '%reference_verified_at%'
      and pg_get_constraintdef(constraint_meta.oid) not like '%start_date%'
  ),
  'planning readiness uses approved period fields and verified course references'
);

select throws_ok(
  $$update marketing_ops.campaigns set starts_on = '2026-08-01', ends_on = '2026-08-31', status = 'planned' where id = 'c1111111-1111-4111-8111-111111111111'$$,
  '23514',
  null,
  'an unverified course cannot become planned'
);

select lives_ok(
  $$
    update marketing_ops.campaigns
    set starts_on = '2026-08-01',
        ends_on = '2026-08-31',
        reference_document_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        reference_verified_at = now(),
        status = 'planned'
    where id = 'c1111111-1111-4111-8111-111111111111'
  $$,
  'a complete campaign with a primary owner can become planned'
);

select throws_ok(
  $$
    insert into marketing_ops.campaign_materials (
      tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
      content_type, size_bytes, sha256, source, created_by
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
      'f1111111-1111-4111-8111-111111111111', '   ', 'brief.pdf', 'application/pdf', 10,
      repeat('a', 64), 'upload', '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'artifact owner cannot be blank'
);

select throws_ok(
  $$
    insert into marketing_ops.campaign_materials (
      tenant_id, campaign_id, artifact_id, artifact_owner_id, filename,
      content_type, size_bytes, sha256, source, created_by
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111',
      'f2222222-2222-4222-8222-222222222222', repeat('x', 201), 'brief.pdf', 'application/pdf', 10,
      repeat('b', 64), 'existing_artifact', '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'artifact owner has a bounded identifier'
);

select throws_ok(
  $$select 'marketing_ops'::marketing_ops.campaign_material_source$$,
  '22P02',
  null,
  'material source rejects values outside the approved contract'
);

select ok(
  coalesce((
    select
      pg_get_expr(column_default.adbin, column_default.adrelid) like '%name%'
      and pg_get_expr(column_default.adbin, column_default.adrelid) like '%reference_title_snapshot%'
      and pg_get_expr(column_default.adbin, column_default.adrelid) not like '%objective%'
      and pg_get_expr(column_default.adbin, column_default.adrelid) not like '%reference_key%'
      and pg_get_expr(column_default.adbin, column_default.adrelid) not like '%briefing%'
      and pg_get_expr(column_default.adbin, column_default.adrelid) not like '%notes%'
    from pg_attribute as column_meta
    join pg_attrdef as column_default
      on column_default.adrelid = column_meta.attrelid
     and column_default.adnum = column_meta.attnum
    where column_meta.attrelid = 'marketing_ops.campaigns'::regclass
      and column_meta.attname = 'search_vector'
      and column_meta.attgenerated = 's'
  ), false),
  'generated search is limited to approved non-sensitive fields'
);

select lives_ok(
  $test$
    do $search$
    begin
      if (
        select count(*)
        from marketing_ops.campaigns
        where id = 'c1111111-1111-4111-8111-111111111111'
          and search_vector @@ plainto_tsquery('simple', 'member')
          and search_vector @@ plainto_tsquery('simple', 'official course')
          and not search_vector @@ plainto_tsquery('simple', 'demand')
          and not search_vector @@ plainto_tsquery('simple', 'course-alpha')
          and not search_vector @@ plainto_tsquery('simple', 'briefingsecret')
          and not search_vector @@ plainto_tsquery('simple', 'notessecret')
      ) <> 1 then
        raise exception 'unexpected campaign search document';
      end if;
    end
    $search$
  $test$,
  'search includes name/title and excludes objective/key/briefing/notes'
);

select ok(
  exists (
    select 1
    from pg_class as index_class
    join pg_index as index_meta on index_meta.indexrelid = index_class.oid
    join pg_am as access_method on access_method.oid = index_class.relam
    where index_class.oid = to_regclass('marketing_ops.campaigns_tenant_search_idx')
      and index_meta.indrelid = 'marketing_ops.campaigns'::regclass
      and access_method.amname = 'gin'
      and pg_get_indexdef(index_class.oid) like '%(search_vector)%'
  ),
  'campaign search uses the intended GIN index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'marketing_ops'
      and tablename = 'campaigns'
      and indexname = 'campaigns_tenant_reference_idx'
      and indexdef like '%(tenant_id, reference_type, reference_key)%'
  ),
  'campaign reference index is scoped and ordered for equality filters'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'marketing_ops'
      and tablename = 'campaigns'
      and indexname = 'campaigns_tenant_period_idx'
      and indexdef like '%(tenant_id, starts_on, ends_on)%'
  ),
  'campaign period index uses the approved fields with tenant first'
);

select ok(
  exists (
    select 1
    from pg_class as index_class
    join pg_index as index_meta on index_meta.indexrelid = index_class.oid
    where index_class.oid = to_regclass('marketing_ops.campaign_members_one_primary_idx')
      and index_meta.indrelid = 'marketing_ops.campaign_members'::regclass
      and index_meta.indisunique
      and pg_get_indexdef(index_class.oid) like '%(campaign_id) WHERE is_primary'
  ),
  'one primary owner is capped by a unique partial campaign index'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'marketing_ops.campaign_members'::regclass
      and tgname = 'campaign_members_promote_first_owner'
      and not tgisinternal
      and pg_get_triggerdef(oid) like '%BEFORE INSERT OR UPDATE%'
      and pg_get_triggerdef(oid) like '%marketing_ops_private.promote_first_campaign_owner()%'
  )
  and exists (
    select 1
    from pg_trigger
    where tgrelid = 'marketing_ops.campaign_members'::regclass
      and tgname = 'campaign_members_require_primary_owner'
      and tgdeferrable and tginitdeferred
      and pg_get_triggerdef(oid) like '%CONSTRAINT TRIGGER%'
  )
  and exists (
    select 1
    from pg_trigger
    where tgrelid = 'marketing_ops.campaigns'::regclass
      and tgname = 'campaigns_require_primary_owner'
      and tgdeferrable and tginitdeferred
      and pg_get_triggerdef(oid) like '%CONSTRAINT TRIGGER%'
  ),
  'primary ownership uses auto-promotion plus deferred minimum-cardinality triggers'
);

select ok(
  coalesce((
    select table_meta.relrowsecurity
      and table_meta.relforcerowsecurity
      and (select count(*) = 3 from pg_policy where polrelid = table_meta.oid)
    from pg_class as table_meta
    where table_meta.oid = to_regclass('marketing_ops.campaign_materials')
  ), false),
  'campaign materials force RLS with separate read/link/unlink policies'
);

select ok(
  to_regclass('marketing_ops.campaign_materials_campaign_idx') is not null
    and to_regclass('marketing_ops.campaign_materials_created_by_idx') is not null
    and to_regclass('marketing_ops.campaign_materials_unlinked_by_idx') is not null
    and exists (
      select 1
      from pg_indexes
      where schemaname = 'marketing_ops'
        and tablename = 'campaign_materials'
        and indexname = 'campaign_materials_campaign_active_idx'
        and indexdef like '%(tenant_id, campaign_id, created_at DESC, id) WHERE (unlinked_at IS NULL)'
    ),
  'material foreign keys and active-list access paths are indexed'
);

select ok(
  not coalesce(has_table_privilege('anon', to_regclass('marketing_ops.campaign_materials'), 'SELECT'), false)
    and coalesce(has_table_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'SELECT'), false)
    and coalesce(has_table_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'INSERT'), false)
    and coalesce(has_column_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'unlinked_by', 'UPDATE'), false)
    and coalesce(has_column_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'unlinked_at', 'UPDATE'), false)
    and not coalesce(has_table_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'DELETE'), false),
  'campaign material grants remain explicit and minimal'
);

select has_function(
  'marketing_ops_private',
  'list_campaign_timeline',
  array['uuid', 'integer', 'timestamp with time zone', 'uuid'],
  'safe campaign timeline projection exists'
);

select * from finish();

rollback;
