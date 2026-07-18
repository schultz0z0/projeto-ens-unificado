alter table marketing_ops.content_assets
  add constraint content_assets_tenant_item_id_unique
  unique (tenant_id, item_id, id);

alter table marketing_ops.item_artifacts
  drop constraint item_artifacts_asset_fk,
  add constraint item_artifacts_asset_fk
    foreign key (tenant_id, item_id, asset_id)
    references marketing_ops.content_assets(tenant_id, item_id, id);

create function marketing_ops_private.create_content_version(
  p_asset_id uuid,
  p_expected_version bigint,
  p_body text,
  p_metadata jsonb,
  p_content_hash text,
  p_freeze boolean default false
)
returns table (
  tenant_id uuid,
  asset_id uuid,
  version_number integer,
  body text,
  metadata jsonb,
  content_hash text,
  created_by uuid,
  created_at timestamptz,
  frozen_at timestamptz,
  asset_version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_tenant_id uuid := marketing_ops_private.current_tenant_id();
  asset_record record;
  next_version_number integer;
begin
  if actor_id is null or request_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authenticated tenant context is required';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using
      errcode = '23514',
      constraint = 'content_assets_expected_version_valid',
      message = 'Expected content asset version must be positive';
  end if;

  if
    p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 16384
  then
    raise exception using
      errcode = '23514',
      constraint = 'content_versions_metadata_valid',
      message = 'Content metadata must be a bounded object';
  end if;

  if pg_catalog.octet_length(coalesce(p_body, '')) > 1048576 then
    raise exception using
      errcode = '23514',
      constraint = 'content_versions_body_size',
      message = 'Content body exceeds the allowed size';
  end if;

  if not marketing_ops_private.can_edit_content_asset(p_asset_id) then
    raise exception using
      errcode = '42501',
      message = 'Content asset does not grant mutation authority';
  end if;

  select
    asset.tenant_id,
    asset.current_version_number,
    asset.version,
    item.status
  into asset_record
  from marketing_ops.content_assets as asset
  join marketing_ops.campaign_items as item
    on item.tenant_id = asset.tenant_id
    and item.campaign_id = asset.campaign_id
    and item.id = asset.item_id
  where asset.id = p_asset_id
    and asset.tenant_id = request_tenant_id
  for update of asset;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Content asset is not visible';
  end if;

  if asset_record.status in ('completed', 'cancelled') then
    raise exception using
      errcode = '23514',
      constraint = 'content_versions_nonterminal_item',
      message = 'Terminal production item content is read-only';
  end if;

  if asset_record.version <> p_expected_version then
    return;
  end if;

  if p_content_hash is distinct from pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(coalesce(p_body, ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'content_versions_hash_match',
      message = 'Content hash does not match the body';
  end if;

  next_version_number := asset_record.current_version_number + 1;
  insert into marketing_ops.content_versions (
    tenant_id,
    asset_id,
    version_number,
    body,
    metadata,
    content_hash,
    created_by,
    frozen_at
  ) values (
    request_tenant_id,
    p_asset_id,
    next_version_number,
    p_body,
    p_metadata,
    p_content_hash,
    actor_id,
    case when coalesce(p_freeze, false) then pg_catalog.now() else null end
  );

  update marketing_ops.content_assets as asset
  set
    current_version_number = next_version_number,
    version = asset.version + 1,
    updated_by = actor_id
  where asset.id = p_asset_id;

  return query
  select
    content_version.tenant_id,
    content_version.asset_id,
    content_version.version_number,
    content_version.body,
    content_version.metadata,
    content_version.content_hash,
    content_version.created_by,
    content_version.created_at,
    content_version.frozen_at,
    asset.version
  from marketing_ops.content_versions as content_version
  join marketing_ops.content_assets as asset
    on asset.tenant_id = content_version.tenant_id
    and asset.id = content_version.asset_id
  where content_version.asset_id = p_asset_id
    and content_version.version_number = next_version_number;
end
$$;

create function marketing_ops_private.backfill_legacy_item_content()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with material_items as (
    select item.*
    from marketing_ops.campaign_items as item
    where item.content is not null
      and item.content <> 'null'::jsonb
      and item.content <> '{}'::jsonb
      and item.content <> '[]'::jsonb
      and item.content <> '""'::jsonb
      and not exists (
        select 1
        from marketing_ops.content_assets as existing_asset
        where existing_asset.tenant_id = item.tenant_id
          and existing_asset.item_id = item.id
          and existing_asset.asset_kind = 'legacy_campaign_item'
      )
  ),
  inserted_assets as (
    insert into marketing_ops.content_assets (
      tenant_id,
      campaign_id,
      item_id,
      asset_kind,
      title,
      current_version_number,
      version,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    select
      item.tenant_id,
      item.campaign_id,
      item.id,
      'legacy_campaign_item',
      left(item.title || ' (legado)', 200),
      1,
      2,
      item.created_by,
      item.updated_by,
      item.created_at,
      item.updated_at
    from material_items as item
    returning id, tenant_id, item_id, created_by, created_at
  )
  insert into marketing_ops.content_versions (
    tenant_id,
    asset_id,
    version_number,
    body,
    metadata,
    content_hash,
    created_by,
    created_at,
    frozen_at
  )
  select
    asset.tenant_id,
    asset.id,
    1,
    item.content::text,
    '{"legacy":true,"source":"legacy_campaign_item"}'::jsonb,
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(item.content::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    asset.created_by,
    asset.created_at,
    pg_catalog.now()
  from inserted_assets as asset
  join marketing_ops.campaign_items as item
    on item.tenant_id = asset.tenant_id
    and item.id = asset.item_id;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$$;

select marketing_ops_private.backfill_legacy_item_content();

revoke insert, update on table marketing_ops.content_versions from authenticated;
revoke update on table marketing_ops.content_assets from authenticated;

revoke all on function marketing_ops_private.create_content_version(
  uuid, bigint, text, jsonb, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.create_content_version(
  uuid, bigint, text, jsonb, text, boolean
) to authenticated;

revoke all on function marketing_ops_private.backfill_legacy_item_content()
  from public, anon, authenticated, service_role;
