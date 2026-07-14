begin;

select plan(32);

select has_column('marketing_ops', 'campaigns', 'objective', 'campaigns have an objective');
select has_column('marketing_ops', 'campaigns', 'reference_type', 'campaigns have a reference type');
select has_column('marketing_ops', 'campaigns', 'reference_key', 'campaigns have a reference key');
select has_column('marketing_ops', 'campaigns', 'reference_title_snapshot', 'campaigns snapshot the reference title');
select has_column('marketing_ops', 'campaigns', 'reference_document_id', 'campaigns can retain a reference document id');
select has_column('marketing_ops', 'campaigns', 'reference_verified_at', 'campaigns retain reference verification time');
select has_column('marketing_ops', 'campaigns', 'audience', 'campaigns have an audience');
select has_column('marketing_ops', 'campaigns', 'start_date', 'campaigns have a start date');
select has_column('marketing_ops', 'campaigns', 'end_date', 'campaigns have an end date');
select has_column('marketing_ops', 'campaigns', 'channels', 'campaigns have controlled channels');
select has_column('marketing_ops', 'campaigns', 'briefing', 'campaigns have a briefing');
select has_column('marketing_ops', 'campaigns', 'notes', 'campaigns have operational notes');
select has_column('marketing_ops', 'campaigns', 'search_vector', 'campaigns have a generated search vector');
select has_column('marketing_ops', 'campaign_members', 'is_primary', 'campaign members identify the primary owner');
select has_table('marketing_ops', 'campaign_materials', 'campaign materials table exists');

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
  'campaign status exposes the complete ordered lifecycle'
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
  'reference type exposes the supported values'
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
  'email,instagram,facebook,linkedin,youtube,whatsapp,site,paid_media,event,other',
  'campaign channel exposes the supported values'
);

select has_column('marketing_ops', 'campaigns', 'course_slug', 'legacy course slug remains available');

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conname = any (array[
      'campaigns_name_length',
      'campaigns_objective_length',
      'campaigns_reference_key_length',
      'campaigns_reference_title_length',
      'campaigns_audience_length',
      'campaigns_briefing_length',
      'campaigns_notes_length',
      'campaigns_channels_limit',
      'campaigns_period_valid',
      'campaigns_reference_consistent',
      'campaigns_planning_fields_required',
      'campaign_members_primary_owner',
      'campaign_materials_size',
      'campaign_materials_sha256',
      'campaign_materials_unlink_consistent'
    ])
  ),
  15,
  'campaign, owner, and material invariants are constrained'
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
          and search_vector @@ plainto_tsquery('simple', 'demand')
          and search_vector @@ plainto_tsquery('simple', 'course-alpha')
          and search_vector @@ plainto_tsquery('simple', 'official course')
          and not search_vector @@ plainto_tsquery('simple', 'briefingsecret')
          and not search_vector @@ plainto_tsquery('simple', 'notessecret')
      ) <> 1 then
        raise exception 'unexpected campaign search document';
      end if;
    end
    $search$
  $test$,
  'search covers public campaign fields and excludes briefing and notes'
);

select ok(
  exists (
    select 1
    from pg_class as index_class
    join pg_index as index_meta on index_meta.indexrelid = index_class.oid
    join pg_am as access_method on access_method.oid = index_class.relam
    where index_class.oid = to_regclass('marketing_ops.campaigns_tenant_search_idx')
      and access_method.amname = 'gin'
      and pg_get_indexdef(index_class.oid) like '%(search_vector)%'
  ),
  'campaign search uses a GIN index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'marketing_ops'
      and indexname = 'campaigns_tenant_reference_idx'
      and indexdef like '%(tenant_id, reference_type, reference_key)%'
  ),
  'campaign reference index places equality columns first'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'marketing_ops'
      and indexname = 'campaigns_tenant_period_idx'
      and indexdef like '%(tenant_id, start_date, end_date)%'
  ),
  'campaign period index places tenant equality before date ranges'
);

select ok(
  exists (
    select 1
    from pg_class as index_class
    join pg_index as index_meta on index_meta.indexrelid = index_class.oid
    where index_class.oid = to_regclass('marketing_ops.campaign_members_one_primary_idx')
      and index_meta.indisunique
      and pg_get_indexdef(index_class.oid) like '%(campaign_id) WHERE is_primary'
  ),
  'one primary owner is enforced by a unique partial campaign index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'marketing_ops'
      and indexname = 'campaign_materials_campaign_active_idx'
      and indexdef like '%(tenant_id, campaign_id, created_at DESC, id) WHERE (unlinked_at IS NULL)'
  ),
  'active campaign materials use a partial list index'
);

select ok(
  to_regclass('marketing_ops.campaign_materials_campaign_idx') is not null
    and to_regclass('marketing_ops.campaign_materials_created_by_idx') is not null
    and to_regclass('marketing_ops.campaign_materials_unlinked_by_idx') is not null,
  'every campaign material foreign key has a usable index'
);

select ok(
  coalesce((
    select table_meta.relrowsecurity
      and table_meta.relforcerowsecurity
      and (
        select count(*) = 3
        from pg_policy
        where polrelid = table_meta.oid
      )
    from pg_class as table_meta
    where table_meta.oid = to_regclass('marketing_ops.campaign_materials')
  ), false),
  'campaign materials force RLS and define read, link, and unlink policies'
);

select ok(
  not coalesce(has_table_privilege('anon', to_regclass('marketing_ops.campaign_materials'), 'SELECT'), false)
    and not coalesce(has_table_privilege('anon', to_regclass('marketing_ops.campaign_materials'), 'INSERT'), false)
    and not coalesce(has_table_privilege('anon', to_regclass('marketing_ops.campaign_materials'), 'UPDATE'), false)
    and not coalesce(has_table_privilege('anon', to_regclass('marketing_ops.campaign_materials'), 'DELETE'), false),
  'anon has no campaign material privileges'
);

select ok(
  coalesce(has_table_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'SELECT'), false)
    and coalesce(has_table_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'INSERT'), false)
    and coalesce(has_column_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'unlinked_by', 'UPDATE'), false)
    and coalesce(has_column_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'unlinked_at', 'UPDATE'), false)
    and not coalesce(has_table_privilege('authenticated', to_regclass('marketing_ops.campaign_materials'), 'DELETE'), false),
  'authenticated receives only the material privileges needed for linking and unlinking'
);

select lives_ok(
  $test$
    do $owners$
    begin
      if exists (
        select 1
        from marketing_ops.campaigns as campaign
        left join marketing_ops.campaign_members as participant
          on participant.campaign_id = campaign.id
        group by campaign.id, campaign.status
        having campaign.status::text <> 'draft'
          or count(*) filter (where participant.is_primary) <> 1
          or count(*) filter (where participant.is_primary and participant.member_role <> 'owner') <> 0
      ) then
        raise exception 'invalid existing campaign owner state';
      end if;
    end
    $owners$
  $test$,
  'existing campaigns remain drafts with exactly one primary owner'
);

select lives_ok(
  $$
    insert into marketing_ops.campaign_members (
      tenant_id, campaign_id, user_id, member_role, is_primary, created_by
    ) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'editor', false, '11111111-1111-4111-8111-111111111111'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'viewer', false, '11111111-1111-4111-8111-111111111111')
  $$,
  'multiple non-primary campaign members are allowed'
);

select * from finish();

rollback;
