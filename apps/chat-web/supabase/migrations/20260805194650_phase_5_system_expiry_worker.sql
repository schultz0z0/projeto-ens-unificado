-- Phase 5 hardening: expiration is a bounded service-owned workflow. It must
-- never be attributed to a human who merely opened the approval queue.

alter table marketing_ops.approval_decisions
  alter column decided_by drop not null,
  alter column decider_role drop not null,
  add column decision_origin text not null default 'human';

alter table marketing_ops.approval_decisions
  add constraint approval_decisions_origin_valid check (
    (decision_origin = 'human' and decided_by is not null and decider_role is not null)
    or (decision_origin = 'system' and decision = 'expired'
      and decided_by is null and decider_role is null)
  );

alter table marketing_ops.audit_events
  alter column actor_user_id drop not null,
  alter column actor_role drop not null;

alter table marketing_ops.audit_events
  add constraint audit_events_service_identity_valid check (
    (actor_type = 'service' and origin = 'internal'
      and actor_user_id is null and actor_role is null)
    or (actor_type <> 'service' and actor_user_id is not null and actor_role is not null)
  ) not valid;
alter table marketing_ops.audit_events
  validate constraint audit_events_service_identity_valid;

drop policy approval_decisions_insert on marketing_ops.approval_decisions;
create policy approval_decisions_insert on marketing_ops.approval_decisions
for insert to authenticated
with check (
  decision_origin = 'human'
  and tenant_id = (select marketing_ops_private.current_tenant_id())
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
  system_origin text := nullif(current_setting('marketing_ops.system_origin', true), '');
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
    if old.expires_at > now() then
      raise exception 'approval cannot expire yet' using errcode = '42501';
    end if;
    if system_origin is distinct from 'approval_expiry_worker'
      and (actor_role is null or actor_role not in ('manager', 'admin')) then
      raise exception 'approval expiration requires the trusted worker' using errcode = '42501';
    end if;
  else
    raise exception 'invalid approval terminal status' using errcode = '23514';
  end if;

  if not exists (
    select 1 from marketing_ops.approval_decisions as decision
    where decision.tenant_id = old.tenant_id
      and decision.request_id = old.id
      and decision.decision = new.status
      and decision.correlation_id = correlation
      and (
        (system_origin = 'approval_expiry_worker'
          and decision.decision_origin = 'system'
          and decision.decided_by is null)
        or (system_origin is distinct from 'approval_expiry_worker'
          and decision.decision_origin = 'human'
          and decision.decided_by = actor_id)
      )
  ) then
    raise exception 'approval request transition requires its matching decision'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

insert into marketing_ops.schema_versions (version, description)
values ('5.0.3', 'Phase 5 bounded system-owned approval expiration worker');
