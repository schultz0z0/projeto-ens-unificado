-- Phase 5 hardening: all approval writes cross the audited Marketing Ops service
-- boundary, and terminal states are derived from their matching human decision.

create function marketing_ops_private.require_approval_service_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(current_setting('marketing_ops.correlation_id', true), '') is null then
    raise exception 'approval writes require the trusted service context'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function marketing_ops_private.protect_approval_request_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.tenant_id, new.campaign_id, new.kind, new.requested_by, new.reason,
    new.risk_level, new.content_asset_id, new.content_version_number,
    new.action_package_id, new.target_hash, new.supersedes_request_id,
    new.expires_at, new.created_at
  ) is distinct from row(
    old.tenant_id, old.campaign_id, old.kind, old.requested_by, old.reason,
    old.risk_level, old.content_asset_id, old.content_version_number,
    old.action_package_id, old.target_hash, old.supersedes_request_id,
    old.expires_at, old.created_at
  ) then
    raise exception 'approval request target is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function marketing_ops_private.enforce_approval_request_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role marketing_ops.membership_role;
  correlation uuid := nullif(current_setting('marketing_ops.correlation_id', true), '')::uuid;
begin
  if new.status = old.status then
    if new.version <> old.version then
      raise exception 'approval version can change only with status' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status <> 'pending' or new.version <> old.version + 1 then
    raise exception 'invalid approval request transition' using errcode = '23514';
  end if;

  actor_role := marketing_ops_private.current_actor_role(old.tenant_id);
  if new.status in ('approved', 'rejected', 'changes_requested') then
    if actor_role is null or actor_role not in ('manager', 'admin') then
      raise exception 'approval decision requires manager or admin' using errcode = '42501';
    end if;
    if old.kind = 'operational' and actor_id = old.requested_by then
      raise exception 'operational self approval is forbidden' using errcode = '42501';
    end if;
    if not exists (
      select 1 from marketing_ops.approval_decisions as decision
      where decision.tenant_id = old.tenant_id
        and decision.request_id = old.id
        and decision.decision = new.status
        and decision.decided_by = actor_id
        and decision.correlation_id = correlation
    ) then
      raise exception 'approval request transition requires its matching decision'
        using errcode = '23514';
    end if;
  elsif new.status = 'cancelled' then
    if actor_id is distinct from old.requested_by then
      raise exception 'only the requester can cancel approval' using errcode = '42501';
    end if;
  elsif new.status = 'expired' then
    if actor_role is null or actor_role not in ('manager', 'admin') or old.expires_at > now() then
      raise exception 'approval cannot expire yet' using errcode = '42501';
    end if;
  else
    raise exception 'invalid approval terminal status' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function marketing_ops_private.enforce_action_package_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  correlation uuid := nullif(current_setting('marketing_ops.correlation_id', true), '')::uuid;
begin
  if new.status = old.status then
    if new.version <> old.version then
      raise exception 'action package version can change only with status' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.status <> 'pending_approval' or new.version <> old.version + 1 then
    raise exception 'invalid action package transition' using errcode = '23514';
  end if;

  if new.status = 'authorized' then
    if not exists (
      select 1
      from marketing_ops.approval_requests as request
      join marketing_ops.approval_decisions as decision
        on decision.tenant_id = request.tenant_id and decision.request_id = request.id
      where request.tenant_id = old.tenant_id
        and request.id = new.authorized_by_request_id
        and request.kind = 'operational'
        and request.action_package_id = old.id
        and request.target_hash = old.payload_hash
        and request.status = 'approved'
        and decision.decision = 'approved'
        and decision.decided_by <> request.requested_by
        and decision.correlation_id = correlation
    ) then
      raise exception 'authorized package requires its approved request and decision'
        using errcode = '23514';
    end if;
  elsif new.status = 'invalidated' then
    if not exists (
      select 1 from marketing_ops.approval_requests as request
      where request.tenant_id = old.tenant_id
        and request.action_package_id = old.id
        and request.status in ('rejected', 'changes_requested', 'cancelled')
    ) then
      raise exception 'package invalidation requires a terminal approval request'
        using errcode = '23514';
    end if;
  elsif new.status = 'expired' then
    if old.expires_at > now() or not exists (
      select 1 from marketing_ops.approval_requests as request
      where request.tenant_id = old.tenant_id
        and request.action_package_id = old.id
        and request.status = 'expired'
    ) then
      raise exception 'package cannot expire before its approval request'
        using errcode = '23514';
    end if;
  else
    raise exception 'invalid action package terminal status' using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table marketing_ops.approval_decisions
  add constraint approval_decisions_business_decision check (
    decision in ('approved', 'rejected', 'changes_requested')
  );

create trigger approval_requests_service_write
before insert or update on marketing_ops.approval_requests
for each row execute function marketing_ops_private.require_approval_service_context();
create trigger approval_requests_state_machine
before update on marketing_ops.approval_requests
for each row execute function marketing_ops_private.enforce_approval_request_transition();
create trigger approval_decisions_service_write
before insert on marketing_ops.approval_decisions
for each row execute function marketing_ops_private.require_approval_service_context();
create trigger action_packages_service_write
before insert or update on marketing_ops.action_packages
for each row execute function marketing_ops_private.require_approval_service_context();
create trigger action_packages_state_machine
before update on marketing_ops.action_packages
for each row execute function marketing_ops_private.enforce_action_package_transition();

revoke all on function marketing_ops_private.require_approval_service_context()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.enforce_approval_request_transition()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.enforce_action_package_transition()
  from public, anon, authenticated, service_role;
