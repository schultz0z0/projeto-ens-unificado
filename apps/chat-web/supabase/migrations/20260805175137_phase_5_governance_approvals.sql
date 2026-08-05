create type marketing_ops.approval_kind as enum ('editorial', 'operational');
create type marketing_ops.approval_status as enum (
  'pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'expired'
);
create type marketing_ops.approval_risk as enum ('low', 'medium', 'high', 'critical');
create type marketing_ops.action_package_status as enum (
  'pending_approval', 'authorized', 'invalidated', 'expired'
);

create table marketing_ops.action_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  created_by uuid not null,
  action_type text not null,
  channel text not null,
  audience_snapshot jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  time_zone text not null default 'UTC',
  configuration jsonb not null default '{}'::jsonb,
  success_criteria text,
  risk_summary text,
  payload jsonb not null,
  payload_hash text not null,
  status marketing_ops.action_package_status not null default 'pending_approval',
  authorized_by_request_id uuid,
  authorized_at timestamptz,
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  invalidation_reason text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_packages_tenant_id_unique unique (tenant_id, id),
  constraint action_packages_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint action_packages_created_by_fk foreign key (tenant_id, created_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint action_packages_identity_valid check (
    btrim(action_type) <> '' and char_length(action_type) <= 100
    and btrim(channel) <> '' and char_length(channel) <= 64
    and btrim(time_zone) <> '' and char_length(time_zone) <= 100
  ),
  constraint action_packages_json_valid check (
    jsonb_typeof(audience_snapshot) = 'object'
    and jsonb_typeof(configuration) = 'object'
    and jsonb_typeof(payload) = 'object'
    and octet_length(audience_snapshot::text) <= 65536
    and octet_length(configuration::text) <= 65536
    and octet_length(payload::text) <= 262144
  ),
  constraint action_packages_hash_format check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint action_packages_text_limits check (
    char_length(coalesce(success_criteria, '')) <= 2000
    and char_length(coalesce(risk_summary, '')) <= 2000
    and char_length(coalesce(invalidation_reason, '')) <= 2000
  ),
  constraint action_packages_expiry_after_creation check (expires_at > created_at),
  constraint action_packages_version_positive check (version > 0),
  constraint action_packages_authorization_consistent check (
    (status = 'authorized' and authorized_by_request_id is not null and authorized_at is not null
      and invalidated_at is null)
    or (status = 'pending_approval' and authorized_by_request_id is null and authorized_at is null
      and invalidated_at is null)
    or (status in ('invalidated', 'expired') and invalidated_at is not null)
  )
);

create unique index content_versions_tenant_asset_version_uidx
  on marketing_ops.content_versions (tenant_id, asset_id, version_number);

create table marketing_ops.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  kind marketing_ops.approval_kind not null,
  status marketing_ops.approval_status not null default 'pending',
  requested_by uuid not null,
  reason text not null,
  risk_level marketing_ops.approval_risk not null default 'low',
  content_asset_id uuid,
  content_version_number integer,
  action_package_id uuid,
  target_hash text not null,
  supersedes_request_id uuid,
  expires_at timestamptz not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_requests_tenant_id_unique unique (tenant_id, id),
  constraint approval_requests_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint approval_requests_requested_by_fk foreign key (tenant_id, requested_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint approval_requests_content_version_fk
    foreign key (tenant_id, content_asset_id, content_version_number)
    references marketing_ops.content_versions(tenant_id, asset_id, version_number),
  constraint approval_requests_action_package_fk foreign key (tenant_id, action_package_id)
    references marketing_ops.action_packages(tenant_id, id),
  constraint approval_requests_supersedes_fk foreign key (tenant_id, supersedes_request_id)
    references marketing_ops.approval_requests(tenant_id, id),
  constraint approval_requests_target_matches_kind check (
    (kind = 'editorial' and content_asset_id is not null and content_version_number is not null
      and action_package_id is null)
    or (kind = 'operational' and content_asset_id is null and content_version_number is null
      and action_package_id is not null)
  ),
  constraint approval_requests_reason_valid check (
    btrim(reason) <> '' and char_length(reason) <= 4000
  ),
  constraint approval_requests_hash_format check (target_hash ~ '^[0-9a-f]{64}$'),
  constraint approval_requests_expiry_after_creation check (expires_at > created_at),
  constraint approval_requests_version_positive check (version > 0)
);

alter table marketing_ops.action_packages
  add constraint action_packages_authorized_request_fk
  foreign key (tenant_id, authorized_by_request_id)
  references marketing_ops.approval_requests(tenant_id, id);

create table marketing_ops.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  request_id uuid not null unique,
  decision marketing_ops.approval_status not null,
  decided_by uuid not null,
  decider_role marketing_ops.membership_role not null,
  comment text,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint approval_decisions_tenant_id_unique unique (tenant_id, id),
  constraint approval_decisions_request_fk foreign key (tenant_id, request_id)
    references marketing_ops.approval_requests(tenant_id, id),
  constraint approval_decisions_decided_by_fk foreign key (tenant_id, decided_by)
    references marketing_ops.memberships(tenant_id, user_id),
  constraint approval_decisions_terminal check (
    decision in ('approved', 'rejected', 'changes_requested', 'cancelled', 'expired')
  ),
  constraint approval_decisions_comment_required check (
    decision not in ('rejected', 'changes_requested')
    or (comment is not null and btrim(comment) <> '')
  ),
  constraint approval_decisions_comment_limit check (char_length(coalesce(comment, '')) <= 4000),
  constraint approval_decisions_snapshot_valid check (
    jsonb_typeof(eligibility_snapshot) = 'object'
    and octet_length(eligibility_snapshot::text) <= 16384
  )
);

alter table marketing_ops.in_app_notifications
  alter column item_id drop not null,
  add column approval_request_id uuid,
  add constraint in_app_notifications_approval_request_fk
    foreign key (tenant_id, approval_request_id)
    references marketing_ops.approval_requests(tenant_id, id) on delete cascade,
  add constraint in_app_notifications_target_valid check (
    (item_id is not null) <> (approval_request_id is not null)
  );

create index approval_requests_queue_idx
  on marketing_ops.approval_requests (tenant_id, status, risk_level desc, created_at, id);
create index approval_requests_campaign_history_idx
  on marketing_ops.approval_requests (tenant_id, campaign_id, created_at desc, id);
create index approval_requests_expiry_idx
  on marketing_ops.approval_requests (expires_at, id) where status = 'pending';
create index approval_decisions_tenant_created_idx
  on marketing_ops.approval_decisions (tenant_id, created_at desc, id);
create index action_packages_authorized_idx
  on marketing_ops.action_packages (tenant_id, authorized_at desc, id)
  where status = 'authorized';
create index action_packages_expiry_idx
  on marketing_ops.action_packages (expires_at, id)
  where status in ('pending_approval', 'authorized');
create index in_app_notifications_tenant_approval_idx
  on marketing_ops.in_app_notifications (tenant_id, approval_request_id, occurred_at desc)
  where approval_request_id is not null;

create function marketing_ops_private.protect_approval_request_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.tenant_id, new.campaign_id, new.kind, new.requested_by,
    new.content_asset_id, new.content_version_number, new.action_package_id,
    new.target_hash, new.supersedes_request_id, new.created_at
  ) is distinct from row(
    old.tenant_id, old.campaign_id, old.kind, old.requested_by,
    old.content_asset_id, old.content_version_number, old.action_package_id,
    old.target_hash, old.supersedes_request_id, old.created_at
  ) then
    raise exception 'approval request target is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function marketing_ops_private.reject_approval_decision_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'approval decisions are append-only' using errcode = '23514';
end;
$$;

create function marketing_ops_private.protect_action_package_payload()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.tenant_id, new.campaign_id, new.created_by, new.action_type, new.channel,
    new.audience_snapshot, new.scheduled_for, new.time_zone, new.configuration,
    new.success_criteria, new.risk_summary, new.payload, new.payload_hash,
    new.expires_at, new.created_at
  ) is distinct from row(
    old.tenant_id, old.campaign_id, old.created_by, old.action_type, old.channel,
    old.audience_snapshot, old.scheduled_for, old.time_zone, old.configuration,
    old.success_criteria, old.risk_summary, old.payload, old.payload_hash,
    old.expires_at, old.created_at
  ) then
    raise exception 'action package payload is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger approval_requests_target_immutable
before update on marketing_ops.approval_requests
for each row execute function marketing_ops_private.protect_approval_request_target();
create trigger approval_requests_touch_updated_at
before update on marketing_ops.approval_requests
for each row execute function marketing_ops_private.touch_updated_at();
create trigger approval_decisions_append_only
before update or delete on marketing_ops.approval_decisions
for each row execute function marketing_ops_private.reject_approval_decision_mutation();
create trigger action_packages_payload_immutable
before update on marketing_ops.action_packages
for each row execute function marketing_ops_private.protect_action_package_payload();
create trigger action_packages_touch_updated_at
before update on marketing_ops.action_packages
for each row execute function marketing_ops_private.touch_updated_at();

create function marketing_ops_private.can_access_approval_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select request.tenant_id = marketing_ops_private.current_tenant_id()
      and marketing_ops_private.can_access_campaign(request.campaign_id)
    from marketing_ops.approval_requests as request
    where request.id = p_request_id
  ), false)
$$;

create function marketing_ops_private.can_decide_approval_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select request.tenant_id = marketing_ops_private.current_tenant_id()
      and request.status = 'pending'
      and marketing_ops_private.current_actor_role(request.tenant_id) in ('manager', 'admin')
      and (request.kind = 'editorial' or request.requested_by <> auth.uid())
    from marketing_ops.approval_requests as request
    where request.id = p_request_id
  ), false)
$$;

alter table marketing_ops.approval_requests enable row level security;
alter table marketing_ops.approval_requests force row level security;
alter table marketing_ops.approval_decisions enable row level security;
alter table marketing_ops.approval_decisions force row level security;
alter table marketing_ops.action_packages enable row level security;
alter table marketing_ops.action_packages force row level security;

create policy approval_requests_select on marketing_ops.approval_requests
for select to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_access_campaign(campaign_id))
);
create policy approval_requests_insert on marketing_ops.approval_requests
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and requested_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
);
create policy approval_requests_update on marketing_ops.approval_requests
for update to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (
    requested_by = (select auth.uid())
    or (select marketing_ops_private.current_actor_role(tenant_id)) in ('manager', 'admin')
  )
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (
    requested_by = (select auth.uid())
    or (select marketing_ops_private.current_actor_role(tenant_id)) in ('manager', 'admin')
  )
);

create policy approval_decisions_select on marketing_ops.approval_decisions
for select to authenticated
using ((select marketing_ops_private.can_access_approval_request(request_id)));
create policy approval_decisions_insert on marketing_ops.approval_decisions
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and decided_by = (select auth.uid())
  and decider_role = (select marketing_ops_private.current_actor_role(tenant_id))
  and (select marketing_ops_private.can_decide_approval_request(request_id))
);

create policy action_packages_select on marketing_ops.action_packages
for select to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_access_campaign(campaign_id))
);
create policy action_packages_insert on marketing_ops.action_packages
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and created_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
);
create policy action_packages_update on marketing_ops.action_packages
for update to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
);

drop policy in_app_notifications_insert on marketing_ops.in_app_notifications;
create policy in_app_notifications_insert on marketing_ops.in_app_notifications
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (
    (item_id is not null and (select marketing_ops_private.can_edit_campaign_item(item_id)))
    or (approval_request_id is not null
      and (select marketing_ops_private.can_access_approval_request(approval_request_id)))
  )
);

revoke all on table marketing_ops.approval_requests from public, anon, authenticated, service_role;
grant select on table marketing_ops.approval_requests to authenticated;
grant insert (
  id, tenant_id, campaign_id, kind, requested_by, reason, risk_level,
  content_asset_id, content_version_number, action_package_id, target_hash,
  supersedes_request_id, expires_at
) on marketing_ops.approval_requests to authenticated;
grant update (status, version, updated_at) on marketing_ops.approval_requests to authenticated;
grant all on table marketing_ops.approval_requests to service_role;

revoke all on table marketing_ops.approval_decisions from public, anon, authenticated, service_role;
grant select on table marketing_ops.approval_decisions to authenticated;
grant insert (
  id, tenant_id, request_id, decision, decided_by, decider_role, comment,
  eligibility_snapshot, correlation_id
) on marketing_ops.approval_decisions to authenticated;
grant all on table marketing_ops.approval_decisions to service_role;

revoke all on table marketing_ops.action_packages from public, anon, authenticated, service_role;
grant select on table marketing_ops.action_packages to authenticated;
grant insert (
  id, tenant_id, campaign_id, created_by, action_type, channel, audience_snapshot,
  scheduled_for, time_zone, configuration, success_criteria, risk_summary, payload,
  payload_hash, expires_at
) on marketing_ops.action_packages to authenticated;
grant update (
  status, authorized_by_request_id, authorized_at, invalidated_at,
  invalidation_reason, version, updated_at
) on marketing_ops.action_packages to authenticated;
grant all on table marketing_ops.action_packages to service_role;

grant insert (approval_request_id) on marketing_ops.in_app_notifications to authenticated;

revoke all on function marketing_ops_private.can_access_approval_request(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_access_approval_request(uuid) to authenticated;
revoke all on function marketing_ops_private.can_decide_approval_request(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_decide_approval_request(uuid) to authenticated;
revoke all on function marketing_ops_private.protect_approval_request_target()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.reject_approval_decision_mutation()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.protect_action_package_payload()
  from public, anon, authenticated, service_role;

insert into marketing_ops.schema_versions (version, description)
values ('5.0.0', 'Phase 5 governance, approvals and immutable operational packages');
