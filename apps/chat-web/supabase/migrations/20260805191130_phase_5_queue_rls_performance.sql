-- Phase 5 queue performance: resolve campaign visibility once per statement
-- and provide an index matching the stable descending cursor order.

create function marketing_ops_private.accessible_campaign_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select
      marketing_ops_private.current_tenant_id() as tenant_id,
      marketing_ops_private.current_actor_role(
        marketing_ops_private.current_tenant_id()
      ) as actor_role,
      auth.uid() as user_id
  )
  select campaign.id
  from marketing_ops.campaigns as campaign
  cross join actor
  where actor.user_id is not null
    and actor.actor_role is not null
    and campaign.tenant_id = actor.tenant_id
    and (
      actor.actor_role in ('manager', 'admin')
      or (
        actor.actor_role = 'member'
        and exists (
          select 1
          from marketing_ops.campaign_members as participant
          where participant.tenant_id = campaign.tenant_id
            and participant.campaign_id = campaign.id
            and participant.user_id = actor.user_id
        )
      )
    )
$$;

drop policy approval_requests_select on marketing_ops.approval_requests;
create policy approval_requests_select on marketing_ops.approval_requests
for select to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and campaign_id in (select marketing_ops_private.accessible_campaign_ids())
);

create index approval_requests_queue_order_idx
  on marketing_ops.approval_requests
  (tenant_id, status, created_at desc, id desc);

revoke all on function marketing_ops_private.accessible_campaign_ids()
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.accessible_campaign_ids()
  to authenticated;

insert into marketing_ops.schema_versions (version, description)
values ('5.0.2', 'Phase 5 approval queue RLS and cursor-order performance');
