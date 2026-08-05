-- Phase 5 advisor follow-up for the audit stream used by the expiry worker.

create index if not exists audit_events_actor_user_fk_idx
  on marketing_ops.audit_events (actor_user_id)
  where actor_user_id is not null;

drop policy audit_events_insert on marketing_ops.audit_events;
create policy audit_events_insert on marketing_ops.audit_events
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and actor_user_id = (select auth.uid())
  and actor_role = (select marketing_ops_private.current_actor_role(tenant_id))
);

insert into marketing_ops.schema_versions (version, description)
values ('5.0.4', 'Phase 5 audit index and RLS advisor follow-up');
