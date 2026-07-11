create schema if not exists marketing_ops;
create schema if not exists marketing_ops_private;

revoke all on schema marketing_ops from public, anon;
revoke all on schema marketing_ops_private from public, anon;

create type marketing_ops.membership_role as enum ('member', 'manager', 'admin');
create type marketing_ops.campaign_status as enum ('draft', 'archived');
create type marketing_ops.campaign_member_role as enum ('owner', 'editor', 'viewer');
create type marketing_ops.item_status as enum ('draft', 'archived');
create type marketing_ops.actor_type as enum ('user', 'delegated_user', 'service');
create type marketing_ops.origin_type as enum ('rest', 'mcp', 'internal');
create type marketing_ops.idempotency_status as enum ('in_progress', 'completed', 'failed');

create table marketing_ops.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint tenants_name_not_blank check (btrim(name) <> '')
);

create table marketing_ops.memberships (
  tenant_id uuid not null,
  user_id uuid not null,
  role marketing_ops.membership_role not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint memberships_tenant_fk foreign key (tenant_id) references marketing_ops.tenants(id) on delete cascade,
  constraint memberships_user_fk foreign key (user_id) references auth.users(id) on delete cascade
);

create table marketing_ops.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  status marketing_ops.campaign_status not null default 'draft',
  version bigint not null default 1,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint campaigns_tenant_id_unique unique (tenant_id, id),
  constraint campaigns_tenant_fk foreign key (tenant_id) references marketing_ops.tenants(id),
  constraint campaigns_created_by_fk foreign key (created_by) references auth.users(id),
  constraint campaigns_updated_by_fk foreign key (updated_by) references auth.users(id),
  constraint campaigns_name_not_blank check (btrim(name) <> ''),
  constraint campaigns_version_positive check (version > 0),
  constraint campaigns_archive_consistent check ((status = 'archived') = (archived_at is not null))
);

create table marketing_ops.campaign_members (
  tenant_id uuid not null,
  campaign_id uuid not null,
  user_id uuid not null,
  member_role marketing_ops.campaign_member_role not null default 'viewer',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, user_id),
  constraint campaign_members_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint campaign_members_user_fk foreign key (user_id) references auth.users(id) on delete cascade,
  constraint campaign_members_created_by_fk foreign key (created_by) references auth.users(id)
);

create table marketing_ops.campaign_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  kind text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  status marketing_ops.item_status not null default 'draft',
  version bigint not null default 1,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint campaign_items_tenant_id_unique unique (tenant_id, id),
  constraint campaign_items_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint campaign_items_created_by_fk foreign key (created_by) references auth.users(id),
  constraint campaign_items_updated_by_fk foreign key (updated_by) references auth.users(id),
  constraint campaign_items_kind_not_blank check (btrim(kind) <> ''),
  constraint campaign_items_version_positive check (version > 0),
  constraint campaign_items_archive_consistent check ((status = 'archived') = (archived_at is not null))
);

create table marketing_ops.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_user_id uuid not null,
  actor_role marketing_ops.membership_role not null,
  actor_type marketing_ops.actor_type not null,
  origin marketing_ops.origin_type not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint audit_events_tenant_fk foreign key (tenant_id) references marketing_ops.tenants(id),
  constraint audit_events_actor_fk foreign key (actor_user_id) references auth.users(id),
  constraint audit_events_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_events_action_not_blank check (btrim(action) <> '')
);

create table marketing_ops.domain_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1,
  payload jsonb not null,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  publish_attempts integer not null default 0,
  last_error text,
  constraint domain_events_tenant_fk foreign key (tenant_id) references marketing_ops.tenants(id),
  constraint domain_events_event_version_positive check (event_version > 0),
  constraint domain_events_publish_attempts_nonnegative check (publish_attempts >= 0),
  constraint domain_events_names_not_blank check (btrim(aggregate_type) <> '' and btrim(event_type) <> '')
);

create table marketing_ops.idempotency_records (
  tenant_id uuid not null,
  actor_id uuid not null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_ref jsonb,
  status marketing_ops.idempotency_status not null default 'in_progress',
  response_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (tenant_id, actor_id, operation, idempotency_key),
  constraint idempotency_records_tenant_fk foreign key (tenant_id) references marketing_ops.tenants(id) on delete cascade,
  constraint idempotency_records_actor_fk foreign key (actor_id) references auth.users(id) on delete cascade,
  constraint idempotency_records_operation_not_blank check (btrim(operation) <> ''),
  constraint idempotency_records_key_not_blank check (btrim(idempotency_key) <> ''),
  constraint idempotency_records_request_hash_format check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint idempotency_records_expiry_after_creation check (expires_at > created_at)
);

create table marketing_ops.delegation_uses (
  jti text primary key,
  tenant_id uuid not null,
  actor_id uuid not null,
  operation text not null,
  idempotency_key text,
  request_hash text,
  used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint delegation_uses_tenant_fk foreign key (tenant_id) references marketing_ops.tenants(id) on delete cascade,
  constraint delegation_uses_actor_fk foreign key (actor_id) references auth.users(id) on delete cascade,
  constraint delegation_uses_jti_not_blank check (btrim(jti) <> ''),
  constraint delegation_uses_request_hash_format check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$'),
  constraint delegation_uses_expiry_after_use check (expires_at > used_at)
);

create table marketing_ops.schema_versions (
  version text primary key,
  description text not null,
  applied_at timestamptz not null default now(),
  constraint schema_versions_values_not_blank check (btrim(version) <> '' and btrim(description) <> '')
);

create index memberships_user_active_idx on marketing_ops.memberships (user_id, active, tenant_id);
create index campaigns_tenant_status_updated_idx on marketing_ops.campaigns (tenant_id, status, updated_at desc, id);
create index campaigns_tenant_created_by_idx on marketing_ops.campaigns (tenant_id, created_by, updated_at desc);
create index campaign_members_tenant_user_idx on marketing_ops.campaign_members (tenant_id, user_id, campaign_id);
create index campaign_items_tenant_campaign_updated_idx on marketing_ops.campaign_items (tenant_id, campaign_id, updated_at desc, id);
create index audit_events_tenant_created_idx on marketing_ops.audit_events (tenant_id, created_at desc, id);
create index audit_events_tenant_entity_idx on marketing_ops.audit_events (tenant_id, entity_type, entity_id, created_at desc);
create index domain_events_unpublished_idx on marketing_ops.domain_events (available_at, occurred_at, id) where published_at is null;
create index idempotency_records_expires_idx on marketing_ops.idempotency_records (expires_at);
create index delegation_uses_expires_idx on marketing_ops.delegation_uses (expires_at);

create function marketing_ops_private.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('marketing_ops.tenant_id', true), '')::uuid
$$;

create function marketing_ops_private.current_actor_role(p_tenant_id uuid)
returns marketing_ops.membership_role
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from marketing_ops.memberships as membership
  join marketing_ops.tenants as tenant on tenant.id = membership.tenant_id
  where membership.tenant_id = p_tenant_id
    and membership.user_id = auth.uid()
    and membership.active
    and tenant.active
    and p_tenant_id = marketing_ops_private.current_tenant_id()
$$;

create function marketing_ops_private.can_access_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin') then true
      when marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member' then exists (
        select 1
        from marketing_ops.campaign_members as participant
        where participant.campaign_id = campaign.id
          and participant.tenant_id = campaign.tenant_id
          and participant.user_id = auth.uid()
      )
      else false
    end,
    false
  )
  from marketing_ops.campaigns as campaign
  where campaign.id = p_campaign_id
    and campaign.tenant_id = marketing_ops_private.current_tenant_id()
$$;

create function marketing_ops_private.can_manage_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
      or campaign.created_by = auth.uid(),
    false
  )
  from marketing_ops.campaigns as campaign
  where campaign.id = p_campaign_id
    and campaign.tenant_id = marketing_ops_private.current_tenant_id()
$$;

create function marketing_ops_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function marketing_ops_private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'audit_events are immutable';
end;
$$;

create trigger memberships_touch_updated_at before update on marketing_ops.memberships
for each row execute function marketing_ops_private.touch_updated_at();
create trigger campaigns_touch_updated_at before update on marketing_ops.campaigns
for each row execute function marketing_ops_private.touch_updated_at();
create trigger campaign_items_touch_updated_at before update on marketing_ops.campaign_items
for each row execute function marketing_ops_private.touch_updated_at();
create trigger idempotency_records_touch_updated_at before update on marketing_ops.idempotency_records
for each row execute function marketing_ops_private.touch_updated_at();
create trigger audit_events_immutable before update or delete on marketing_ops.audit_events
for each row execute function marketing_ops_private.reject_audit_mutation();

alter table marketing_ops.tenants enable row level security;
alter table marketing_ops.tenants force row level security;
alter table marketing_ops.memberships enable row level security;
alter table marketing_ops.memberships force row level security;
alter table marketing_ops.campaigns enable row level security;
alter table marketing_ops.campaigns force row level security;
alter table marketing_ops.campaign_members enable row level security;
alter table marketing_ops.campaign_members force row level security;
alter table marketing_ops.campaign_items enable row level security;
alter table marketing_ops.campaign_items force row level security;
alter table marketing_ops.audit_events enable row level security;
alter table marketing_ops.audit_events force row level security;
alter table marketing_ops.domain_events enable row level security;
alter table marketing_ops.domain_events force row level security;
alter table marketing_ops.idempotency_records enable row level security;
alter table marketing_ops.idempotency_records force row level security;
alter table marketing_ops.delegation_uses enable row level security;
alter table marketing_ops.delegation_uses force row level security;
alter table marketing_ops.schema_versions enable row level security;
alter table marketing_ops.schema_versions force row level security;

create policy tenants_select on marketing_ops.tenants for select to authenticated
using (id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(id) is not null);

create policy memberships_select on marketing_ops.memberships for select to authenticated
using (
  tenant_id = marketing_ops_private.current_tenant_id()
  and (
    user_id = auth.uid()
    or marketing_ops_private.current_actor_role(tenant_id) in ('manager', 'admin')
  )
);
create policy memberships_insert_admin on marketing_ops.memberships for insert to authenticated
with check (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) = 'admin');
create policy memberships_update_admin on marketing_ops.memberships for update to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) = 'admin')
with check (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) = 'admin');
create policy memberships_delete_admin on marketing_ops.memberships for delete to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) = 'admin');

create policy campaigns_select on marketing_ops.campaigns for select to authenticated
using (marketing_ops_private.can_access_campaign(id));
create policy campaigns_insert on marketing_ops.campaigns for insert to authenticated
with check (
  tenant_id = marketing_ops_private.current_tenant_id()
  and marketing_ops_private.current_actor_role(tenant_id) is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and status = 'draft'
);
create policy campaigns_update on marketing_ops.campaigns for update to authenticated
using (marketing_ops_private.can_access_campaign(id))
with check (
  tenant_id = marketing_ops_private.current_tenant_id()
  and marketing_ops_private.current_actor_role(tenant_id) is not null
  and updated_by = auth.uid()
);

create policy campaign_members_select on marketing_ops.campaign_members for select to authenticated
using (marketing_ops_private.can_access_campaign(campaign_id));
create policy campaign_members_insert on marketing_ops.campaign_members for insert to authenticated
with check (
  tenant_id = marketing_ops_private.current_tenant_id()
  and marketing_ops_private.can_manage_campaign(campaign_id)
  and created_by = auth.uid()
);
create policy campaign_members_update on marketing_ops.campaign_members for update to authenticated
using (marketing_ops_private.can_manage_campaign(campaign_id))
with check (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.can_manage_campaign(campaign_id));
create policy campaign_members_delete on marketing_ops.campaign_members for delete to authenticated
using (marketing_ops_private.can_manage_campaign(campaign_id));

create policy campaign_items_select on marketing_ops.campaign_items for select to authenticated
using (marketing_ops_private.can_access_campaign(campaign_id));
create policy campaign_items_insert on marketing_ops.campaign_items for insert to authenticated
with check (
  tenant_id = marketing_ops_private.current_tenant_id()
  and marketing_ops_private.can_access_campaign(campaign_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and status = 'draft'
);
create policy campaign_items_update on marketing_ops.campaign_items for update to authenticated
using (marketing_ops_private.can_access_campaign(campaign_id))
with check (
  tenant_id = marketing_ops_private.current_tenant_id()
  and marketing_ops_private.can_access_campaign(campaign_id)
  and updated_by = auth.uid()
);

create policy audit_events_select on marketing_ops.audit_events for select to authenticated
using (
  tenant_id = marketing_ops_private.current_tenant_id()
  and marketing_ops_private.current_actor_role(tenant_id) in ('manager', 'admin')
);
create policy audit_events_insert on marketing_ops.audit_events for insert to authenticated
with check (
  tenant_id = marketing_ops_private.current_tenant_id()
  and actor_user_id = auth.uid()
  and actor_role = marketing_ops_private.current_actor_role(tenant_id)
);

create policy domain_events_select on marketing_ops.domain_events for select to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) is not null);
create policy domain_events_insert on marketing_ops.domain_events for insert to authenticated
with check (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) is not null);
create policy domain_events_update on marketing_ops.domain_events for update to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and marketing_ops_private.current_actor_role(tenant_id) in ('manager', 'admin'))
with check (tenant_id = marketing_ops_private.current_tenant_id());

create policy idempotency_records_select on marketing_ops.idempotency_records for select to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and actor_id = auth.uid());
create policy idempotency_records_insert on marketing_ops.idempotency_records for insert to authenticated
with check (tenant_id = marketing_ops_private.current_tenant_id() and actor_id = auth.uid() and marketing_ops_private.current_actor_role(tenant_id) is not null);
create policy idempotency_records_update on marketing_ops.idempotency_records for update to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and actor_id = auth.uid())
with check (tenant_id = marketing_ops_private.current_tenant_id() and actor_id = auth.uid());

create policy delegation_uses_select on marketing_ops.delegation_uses for select to authenticated
using (tenant_id = marketing_ops_private.current_tenant_id() and actor_id = auth.uid());
create policy delegation_uses_insert on marketing_ops.delegation_uses for insert to authenticated
with check (tenant_id = marketing_ops_private.current_tenant_id() and actor_id = auth.uid() and marketing_ops_private.current_actor_role(tenant_id) is not null);

create policy schema_versions_select on marketing_ops.schema_versions for select to authenticated
using (marketing_ops_private.current_actor_role(marketing_ops_private.current_tenant_id()) is not null);

revoke all on all tables in schema marketing_ops from public, anon;
revoke all on all sequences in schema marketing_ops from public, anon;
revoke all on all functions in schema marketing_ops_private from public, anon;

grant usage on schema marketing_ops, marketing_ops_private to authenticated, service_role;
grant select on marketing_ops.tenants to authenticated;
grant select, insert, update, delete on marketing_ops.memberships to authenticated;
grant select, insert, update on marketing_ops.campaigns to authenticated;
grant select, insert, update, delete on marketing_ops.campaign_members to authenticated;
grant select, insert, update on marketing_ops.campaign_items to authenticated;
grant select, insert on marketing_ops.audit_events to authenticated;
grant select, insert, update on marketing_ops.domain_events to authenticated;
grant select, insert, update on marketing_ops.idempotency_records to authenticated;
grant select, insert on marketing_ops.delegation_uses to authenticated;
grant select on marketing_ops.schema_versions to authenticated;
grant all on all tables in schema marketing_ops to service_role;
grant all on all sequences in schema marketing_ops to service_role;
grant execute on function marketing_ops_private.current_tenant_id() to authenticated, service_role;
grant execute on function marketing_ops_private.current_actor_role(uuid) to authenticated, service_role;
grant execute on function marketing_ops_private.can_access_campaign(uuid) to authenticated, service_role;
grant execute on function marketing_ops_private.can_manage_campaign(uuid) to authenticated, service_role;

insert into marketing_ops.schema_versions (version, description)
values ('2026-07-phase-1-foundation', 'Marketing Ops transactional foundation');
