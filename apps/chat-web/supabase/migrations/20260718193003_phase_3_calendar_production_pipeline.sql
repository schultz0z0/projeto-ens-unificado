-- Phase 3: production calendar and pipeline foundation.
--
-- Existing campaign item IDs and optimistic versions are preserved in place.
-- The Phase 1/2 "archived" item state is mapped to the Phase 3 terminal
-- "cancelled" state; archived_at remains as compatibility evidence.

create type marketing_ops.item_kind as enum (
  'task', 'email', 'whatsapp', 'post', 'creative', 'review', 'milestone'
);
create type marketing_ops.item_status_phase_3 as enum (
  'draft', 'ready', 'in_review', 'completed', 'cancelled'
);
create type marketing_ops.item_priority as enum ('low', 'normal', 'high', 'urgent');
create type marketing_ops.item_channel as enum (
  'email', 'instagram', 'linkedin', 'facebook', 'whatsapp',
  'website', 'paid_media', 'events', 'press', 'other'
);

drop policy campaign_items_insert on marketing_ops.campaign_items;
drop policy campaign_items_update on marketing_ops.campaign_items;

alter table marketing_ops.campaign_items
  drop constraint campaign_items_kind_not_blank,
  drop constraint campaign_items_archive_consistent,
  alter column status drop default;

alter table marketing_ops.campaign_items
  alter column kind type marketing_ops.item_kind
    using (
      case
        when kind = any (array[
          'task', 'email', 'whatsapp', 'post', 'creative', 'review', 'milestone'
        ]) then kind
        else 'task'
      end
    )::marketing_ops.item_kind,
  alter column status type marketing_ops.item_status_phase_3
    using (
      case
        when status::text = 'archived' then 'cancelled'
        else 'draft'
      end
    )::marketing_ops.item_status_phase_3;

drop type marketing_ops.item_status;
alter type marketing_ops.item_status_phase_3 rename to item_status;

alter table marketing_ops.campaign_items
  alter column status set default 'draft'::marketing_ops.item_status,
  add column assignee_user_id uuid,
  add column priority marketing_ops.item_priority not null default 'normal',
  add column channel marketing_ops.item_channel,
  add column description text,
  add column starts_at timestamptz,
  add column due_at timestamptz,
  add column metadata jsonb not null default '{}'::jsonb,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz;

update marketing_ops.campaign_items
set
  title = coalesce(nullif(btrim(title), ''), 'Item ' || left(id::text, 8)),
  cancelled_at = case
    when status = 'cancelled' then coalesce(archived_at, updated_at, now())
    else null
  end;

alter table marketing_ops.campaign_items
  alter column title set not null,
  add constraint campaign_items_tenant_campaign_id_unique unique (tenant_id, campaign_id, id),
  add constraint campaign_items_assignee_fk foreign key (tenant_id, assignee_user_id)
    references marketing_ops.memberships(tenant_id, user_id),
  add constraint campaign_items_title_valid
    check (btrim(title) <> '' and char_length(title) <= 200),
  add constraint campaign_items_description_valid
    check (description is null or char_length(description) <= 10000),
  add constraint campaign_items_period_order
    check (starts_at is null or due_at is null or due_at >= starts_at),
  add constraint campaign_items_metadata_valid
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 16384
    ),
  add constraint campaign_items_terminal_timestamps
    check (
      (status = 'completed' and completed_at is not null and cancelled_at is null)
      or (status = 'cancelled' and cancelled_at is not null and completed_at is null)
      or (
        status in ('draft', 'ready', 'in_review')
        and completed_at is null
        and cancelled_at is null
      )
    ),
  add constraint campaign_items_ready_fields
    check (
      status not in ('ready', 'in_review', 'completed')
      or (
        btrim(title) <> ''
        and assignee_user_id is not null
        and due_at is not null
      )
    );

create table marketing_ops.item_dependencies (
  tenant_id uuid not null,
  campaign_id uuid not null,
  item_id uuid not null,
  depends_on_item_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (item_id, depends_on_item_id),
  constraint item_dependencies_item_fk foreign key (tenant_id, campaign_id, item_id)
    references marketing_ops.campaign_items(tenant_id, campaign_id, id) on delete cascade,
  constraint item_dependencies_predecessor_fk foreign key (tenant_id, campaign_id, depends_on_item_id)
    references marketing_ops.campaign_items(tenant_id, campaign_id, id) on delete cascade,
  constraint item_dependencies_created_by_fk foreign key (tenant_id, created_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint item_dependencies_not_self check (item_id <> depends_on_item_id)
);

create table marketing_ops.content_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  item_id uuid not null,
  asset_kind text not null,
  title text not null,
  current_version_number integer not null default 0,
  version bigint not null default 1,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_assets_tenant_id_unique unique (tenant_id, id),
  constraint content_assets_item_fk foreign key (tenant_id, campaign_id, item_id)
    references marketing_ops.campaign_items(tenant_id, campaign_id, id) on delete cascade,
  constraint content_assets_created_by_fk foreign key (tenant_id, created_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint content_assets_updated_by_fk foreign key (tenant_id, updated_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint content_assets_kind_valid
    check (btrim(asset_kind) <> '' and char_length(asset_kind) <= 64),
  constraint content_assets_title_valid
    check (btrim(title) <> '' and char_length(title) <= 200),
  constraint content_assets_current_version_nonnegative check (current_version_number >= 0),
  constraint content_assets_version_positive check (version > 0)
);

create table marketing_ops.content_versions (
  tenant_id uuid not null,
  asset_id uuid not null,
  version_number integer not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  frozen_at timestamptz,
  primary key (asset_id, version_number),
  constraint content_versions_asset_fk foreign key (tenant_id, asset_id)
    references marketing_ops.content_assets(tenant_id, id) on delete cascade,
  constraint content_versions_created_by_fk foreign key (tenant_id, created_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint content_versions_number_positive check (version_number > 0),
  constraint content_versions_metadata_valid check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 16384
  ),
  constraint content_versions_hash_format check (content_hash ~ '^[0-9a-f]{64}$')
);

create table marketing_ops.item_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  item_id uuid not null,
  asset_id uuid,
  artifact_id text not null,
  artifact_owner_id text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unlinked_by uuid,
  unlinked_at timestamptz,
  constraint item_artifacts_item_unique unique (tenant_id, item_id, artifact_id),
  constraint item_artifacts_item_fk foreign key (tenant_id, campaign_id, item_id)
    references marketing_ops.campaign_items(tenant_id, campaign_id, id) on delete cascade,
  constraint item_artifacts_asset_fk foreign key (tenant_id, asset_id)
    references marketing_ops.content_assets(tenant_id, id),
  constraint item_artifacts_created_by_fk foreign key (tenant_id, created_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint item_artifacts_unlinked_by_fk foreign key (tenant_id, unlinked_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint item_artifacts_identity_valid check (
    btrim(artifact_id) <> ''
    and btrim(artifact_owner_id) <> ''
    and btrim(filename) <> ''
    and char_length(filename) <= 512
    and btrim(content_type) <> ''
    and char_length(content_type) <= 255
  ),
  constraint item_artifacts_size_nonnegative check (size_bytes >= 0),
  constraint item_artifacts_hash_format check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint item_artifacts_unlink_consistent check (
    (unlinked_by is null and unlinked_at is null)
    or (unlinked_by is not null and unlinked_at is not null)
  )
);

create table marketing_ops.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  event_key text not null,
  notification_type text not null,
  campaign_id uuid not null,
  item_id uuid not null,
  label text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint in_app_notifications_event_unique unique (tenant_id, user_id, event_key),
  constraint in_app_notifications_user_fk foreign key (tenant_id, user_id)
    references marketing_ops.memberships(tenant_id, user_id) on delete cascade,
  constraint in_app_notifications_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint in_app_notifications_item_fk foreign key (tenant_id, campaign_id, item_id)
    references marketing_ops.campaign_items(tenant_id, campaign_id, id) on delete cascade,
  constraint in_app_notifications_event_key_valid
    check (btrim(event_key) <> '' and char_length(event_key) <= 255),
  constraint in_app_notifications_type_valid
    check (btrim(notification_type) <> '' and char_length(notification_type) <= 80),
  constraint in_app_notifications_label_valid
    check (btrim(label) <> '' and char_length(label) <= 200),
  constraint in_app_notifications_payload_valid check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 16384
  ),
  constraint in_app_notifications_read_order check (read_at is null or read_at >= occurred_at)
);

create index campaign_items_tenant_starts_idx
  on marketing_ops.campaign_items (tenant_id, starts_at, id)
  where starts_at is not null;
create index campaign_items_tenant_due_idx
  on marketing_ops.campaign_items (tenant_id, due_at, id)
  where due_at is not null;
create index campaign_items_tenant_campaign_status_due_idx
  on marketing_ops.campaign_items (tenant_id, campaign_id, status, due_at, id);
create index campaign_items_tenant_assignee_status_due_idx
  on marketing_ops.campaign_items (tenant_id, assignee_user_id, status, due_at, id)
  where assignee_user_id is not null;
create index item_dependencies_tenant_predecessor_idx
  on marketing_ops.item_dependencies (tenant_id, depends_on_item_id, item_id);
create index content_assets_tenant_item_idx
  on marketing_ops.content_assets (tenant_id, item_id, updated_at desc, id);
create index content_versions_tenant_asset_created_idx
  on marketing_ops.content_versions (tenant_id, asset_id, created_at desc, version_number desc);
create index item_artifacts_tenant_item_active_idx
  on marketing_ops.item_artifacts (tenant_id, item_id, created_at desc, id)
  where unlinked_at is null;
create index in_app_notifications_tenant_user_unread_idx
  on marketing_ops.in_app_notifications (tenant_id, user_id, occurred_at desc, id)
  where read_at is null;

create function marketing_ops_private.can_access_campaign_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      item.tenant_id = marketing_ops_private.current_tenant_id()
      and marketing_ops_private.can_access_campaign(item.campaign_id)
    from marketing_ops.campaign_items as item
    where item.id = p_item_id
  ), false)
$$;

create function marketing_ops_private.can_edit_campaign_item(p_item_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce((
    select
      item.tenant_id = marketing_ops_private.current_tenant_id()
      and marketing_ops_private.can_edit_campaign(item.campaign_id)
    from marketing_ops.campaign_items as item
    where item.id = p_item_id
  ), false)
$$;

create function marketing_ops_private.can_access_content_asset(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select marketing_ops_private.can_access_campaign_item(asset.item_id)
    from marketing_ops.content_assets as asset
    where asset.id = p_asset_id
      and asset.tenant_id = marketing_ops_private.current_tenant_id()
  ), false)
$$;

create function marketing_ops_private.can_edit_content_asset(p_asset_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce((
    select marketing_ops_private.can_edit_campaign_item(asset.item_id)
    from marketing_ops.content_assets as asset
    where asset.id = p_asset_id
      and asset.tenant_id = marketing_ops_private.current_tenant_id()
  ), false)
$$;

create function marketing_ops_private.assert_campaign_item_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from marketing_ops.memberships as membership
    where membership.tenant_id = new.tenant_id
      and membership.user_id = new.assignee_user_id
      and membership.active
      and (
        membership.role in ('manager', 'admin')
        or exists (
          select 1
          from marketing_ops.campaign_members as participant
          where participant.tenant_id = new.tenant_id
            and participant.campaign_id = new.campaign_id
            and participant.user_id = new.assignee_user_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'campaign_items_assignee_authorized',
      message = 'campaign item assignee must be active and authorized for the campaign';
  end if;

  return new;
end;
$$;

create or replace function marketing_ops_private.enforce_campaign_item_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transition_edge text := old.status::text || ':' || new.status::text;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if old.status in ('completed', 'cancelled') then
    raise exception using
      errcode = '42501',
      message = 'terminal campaign item is read-only';
  end if;

  if new.version <> old.version + 1 then
    raise exception using
      errcode = '42501',
      message = 'authenticated campaign item update must increment version by one';
  end if;

  if old.status <> new.status and transition_edge <> all (array[
    'draft:ready',
    'draft:cancelled',
    'ready:draft',
    'ready:in_review',
    'ready:cancelled',
    'in_review:ready',
    'in_review:completed',
    'in_review:cancelled'
  ]) then
    raise exception using
      errcode = '23514',
      constraint = 'campaign_items_status_transition',
      message = 'campaign item status transition is not allowed';
  end if;

  return new;
end;
$$;

create function marketing_ops_private.prevent_content_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'content versions are append-only';
end;
$$;

create trigger campaign_items_assert_assignee
before insert or update of tenant_id, campaign_id, assignee_user_id
on marketing_ops.campaign_items
for each row execute function marketing_ops_private.assert_campaign_item_assignee();

create trigger content_assets_touch_updated_at
before update on marketing_ops.content_assets
for each row execute function marketing_ops_private.touch_updated_at();

create trigger content_versions_prevent_update
before update on marketing_ops.content_versions
for each row execute function marketing_ops_private.prevent_content_version_mutation();

create trigger content_versions_prevent_delete
before delete on marketing_ops.content_versions
for each row execute function marketing_ops_private.prevent_content_version_mutation();

create policy campaign_items_insert on marketing_ops.campaign_items
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and status = 'draft'
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
);

create policy campaign_items_update on marketing_ops.campaign_items
for update to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and status not in ('completed', 'cancelled')
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and updated_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
);

alter table marketing_ops.item_dependencies enable row level security;
alter table marketing_ops.item_dependencies force row level security;
alter table marketing_ops.content_assets enable row level security;
alter table marketing_ops.content_assets force row level security;
alter table marketing_ops.content_versions enable row level security;
alter table marketing_ops.content_versions force row level security;
alter table marketing_ops.item_artifacts enable row level security;
alter table marketing_ops.item_artifacts force row level security;
alter table marketing_ops.in_app_notifications enable row level security;
alter table marketing_ops.in_app_notifications force row level security;

create policy item_dependencies_select on marketing_ops.item_dependencies
for select to authenticated
using ((select marketing_ops_private.can_access_campaign_item(item_id)));
create policy item_dependencies_insert on marketing_ops.item_dependencies
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and created_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
  and (select marketing_ops_private.can_edit_campaign_item(depends_on_item_id))
);
create policy item_dependencies_delete on marketing_ops.item_dependencies
for delete to authenticated
using ((select marketing_ops_private.can_edit_campaign_item(item_id)));

create policy content_assets_select on marketing_ops.content_assets
for select to authenticated
using ((select marketing_ops_private.can_access_campaign_item(item_id)));
create policy content_assets_insert on marketing_ops.content_assets
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
);
create policy content_assets_update on marketing_ops.content_assets
for update to authenticated
using ((select marketing_ops_private.can_edit_campaign_item(item_id)))
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and updated_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
);

create policy content_versions_select on marketing_ops.content_versions
for select to authenticated
using ((select marketing_ops_private.can_access_content_asset(asset_id)));
create policy content_versions_insert on marketing_ops.content_versions
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and created_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_content_asset(asset_id))
);

create policy item_artifacts_select on marketing_ops.item_artifacts
for select to authenticated
using ((select marketing_ops_private.can_access_campaign_item(item_id)));
create policy item_artifacts_insert on marketing_ops.item_artifacts
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and created_by = (select auth.uid())
  and unlinked_by is null
  and unlinked_at is null
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
);
create policy item_artifacts_update on marketing_ops.item_artifacts
for update to authenticated
using (
  unlinked_at is null
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and unlinked_by = (select auth.uid())
  and unlinked_at is not null
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
);

create policy in_app_notifications_select on marketing_ops.in_app_notifications
for select to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and user_id = (select auth.uid())
);
create policy in_app_notifications_insert on marketing_ops.in_app_notifications
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_edit_campaign_item(item_id))
);
create policy in_app_notifications_update on marketing_ops.in_app_notifications
for update to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and user_id = (select auth.uid())
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and user_id = (select auth.uid())
  and read_at is not null
);

revoke insert, update on table marketing_ops.campaign_items from authenticated;
grant insert (
  tenant_id, campaign_id, kind, title, assignee_user_id, priority, channel,
  description, starts_at, due_at, metadata, content, created_by, updated_by
) on marketing_ops.campaign_items to authenticated;
grant update (
  kind, title, assignee_user_id, priority, channel, description, starts_at,
  due_at, metadata, content, status, version, updated_by, completed_at, cancelled_at
) on marketing_ops.campaign_items to authenticated;

revoke all on table marketing_ops.item_dependencies from public, anon, authenticated, service_role;
grant select, delete on table marketing_ops.item_dependencies to authenticated;
grant insert (
  tenant_id, campaign_id, item_id, depends_on_item_id, created_by
) on marketing_ops.item_dependencies to authenticated;
grant all on table marketing_ops.item_dependencies to service_role;

revoke all on table marketing_ops.content_assets from public, anon, authenticated, service_role;
grant select on table marketing_ops.content_assets to authenticated;
grant insert (
  id, tenant_id, campaign_id, item_id, asset_kind, title, created_by, updated_by
) on marketing_ops.content_assets to authenticated;
grant update (
  title, current_version_number, version, updated_by
) on marketing_ops.content_assets to authenticated;
grant all on table marketing_ops.content_assets to service_role;

revoke all on table marketing_ops.content_versions from public, anon, authenticated, service_role;
grant select on table marketing_ops.content_versions to authenticated;
grant insert (
  tenant_id, asset_id, version_number, body, metadata, content_hash, created_by, frozen_at
) on marketing_ops.content_versions to authenticated;
grant all on table marketing_ops.content_versions to service_role;

revoke all on table marketing_ops.item_artifacts from public, anon, authenticated, service_role;
grant select on table marketing_ops.item_artifacts to authenticated;
grant insert (
  id, tenant_id, campaign_id, item_id, asset_id, artifact_id, artifact_owner_id,
  filename, content_type, size_bytes, sha256, created_by
) on marketing_ops.item_artifacts to authenticated;
grant update (unlinked_by, unlinked_at) on marketing_ops.item_artifacts to authenticated;
grant all on table marketing_ops.item_artifacts to service_role;

revoke all on table marketing_ops.in_app_notifications from public, anon, authenticated, service_role;
grant select on table marketing_ops.in_app_notifications to authenticated;
grant insert (
  id, tenant_id, user_id, event_key, notification_type, campaign_id, item_id,
  label, payload, occurred_at
) on marketing_ops.in_app_notifications to authenticated;
grant update (read_at) on marketing_ops.in_app_notifications to authenticated;
grant all on table marketing_ops.in_app_notifications to service_role;

revoke all on function marketing_ops_private.can_access_campaign_item(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_access_campaign_item(uuid)
  to authenticated;
revoke all on function marketing_ops_private.can_edit_campaign_item(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_edit_campaign_item(uuid)
  to authenticated;
revoke all on function marketing_ops_private.can_access_content_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_access_content_asset(uuid)
  to authenticated;
revoke all on function marketing_ops_private.can_edit_content_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_edit_content_asset(uuid)
  to authenticated;
revoke all on function marketing_ops_private.assert_campaign_item_assignee()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.prevent_content_version_mutation()
  from public, anon, authenticated, service_role;

insert into marketing_ops.schema_versions (version, description)
values ('2026-07-phase-3-calendar', 'Marketing Ops production calendar and pipeline foundation')
on conflict (version) do nothing;
