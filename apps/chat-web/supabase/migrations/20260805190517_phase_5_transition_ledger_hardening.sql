-- Phase 5 hardening: every terminal transition has one immutable ledger row,
-- supersession cycles are validated in the database, and approval notifications
-- can only be emitted through the audited Marketing Ops service transaction.

alter table marketing_ops.approval_decisions
  drop constraint approval_decisions_business_decision;

drop policy approval_decisions_insert on marketing_ops.approval_decisions;
create policy approval_decisions_insert on marketing_ops.approval_decisions
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and decided_by = (select auth.uid())
  and decider_role = (select marketing_ops_private.current_actor_role(tenant_id))
  and (
    (decision in ('approved', 'rejected', 'changes_requested')
      and (select marketing_ops_private.can_decide_approval_request(request_id)))
    or (decision = 'cancelled' and exists (
      select 1 from marketing_ops.approval_requests as request
      where request.tenant_id = approval_decisions.tenant_id
        and request.id = approval_decisions.request_id
        and request.status = 'pending'
        and request.requested_by = (select auth.uid())
    ))
    or (decision = 'expired'
      and (select marketing_ops_private.current_actor_role(tenant_id)) in ('manager', 'admin')
      and exists (
        select 1 from marketing_ops.approval_requests as request
        where request.tenant_id = approval_decisions.tenant_id
          and request.id = approval_decisions.request_id
          and request.status = 'pending'
          and request.expires_at <= now()
      ))
  )
);

create or replace function marketing_ops_private.enforce_approval_request_transition()
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
  return new;
end;
$$;

create function marketing_ops_private.validate_approval_supersession()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.supersedes_request_id is null then
    return new;
  end if;
  if not exists (
    select 1 from marketing_ops.approval_requests as predecessor
    where predecessor.tenant_id = new.tenant_id
      and predecessor.id = new.supersedes_request_id
      and predecessor.campaign_id = new.campaign_id
      and predecessor.kind = new.kind
      and predecessor.requested_by = new.requested_by
      and predecessor.status = 'changes_requested'
      and predecessor.target_hash <> new.target_hash
  ) then
    raise exception 'invalid approval supersession cycle' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function marketing_ops_private.require_approval_notification_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.approval_request_id is not null
    and nullif(current_setting('marketing_ops.correlation_id', true), '') is null then
    raise exception 'approval notifications require the trusted service context'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger approval_requests_supersession_valid
before insert on marketing_ops.approval_requests
for each row execute function marketing_ops_private.validate_approval_supersession();

create trigger approval_notifications_service_write
before insert on marketing_ops.in_app_notifications
for each row execute function marketing_ops_private.require_approval_notification_context();

revoke all on function marketing_ops_private.validate_approval_supersession()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.require_approval_notification_context()
  from public, anon, authenticated, service_role;

insert into marketing_ops.schema_versions (version, description)
values ('5.0.1', 'Phase 5 immutable terminal ledger and service-bound notifications');
