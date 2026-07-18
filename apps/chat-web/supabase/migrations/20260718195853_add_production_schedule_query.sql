create function marketing_ops_private.list_production_schedule(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_campaign_id uuid default null,
  p_kind marketing_ops.item_kind default null,
  p_channel marketing_ops.item_channel default null,
  p_assignee_user_id uuid default null,
  p_status marketing_ops.item_status default null,
  p_priority marketing_ops.item_priority default null,
  p_cursor_effective_at timestamptz default null,
  p_cursor_priority_rank integer default null,
  p_cursor_id uuid default null,
  p_limit integer default 26
)
returns table (
  id uuid,
  tenant_id uuid,
  campaign_id uuid,
  kind marketing_ops.item_kind,
  title text,
  content jsonb,
  status marketing_ops.item_status,
  version bigint,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  assignee_user_id uuid,
  priority marketing_ops.item_priority,
  channel marketing_ops.item_channel,
  description text,
  starts_at timestamptz,
  due_at timestamptz,
  metadata jsonb,
  completed_at timestamptz,
  cancelled_at timestamptz,
  campaign_name text,
  effective_at timestamptz,
  is_overdue boolean,
  is_blocked boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as materialized (
    select
      marketing_ops_private.current_tenant_id() as tenant_id,
      (select auth.uid()) as user_id
  ),
  actor_context as materialized (
    select
      request_context.tenant_id,
      request_context.user_id,
      marketing_ops_private.current_actor_role(request_context.tenant_id) as role
    from request_context
  ),
  filtered_items as materialized (
    select
      item.id,
      item.tenant_id,
      item.campaign_id,
      item.kind,
      item.title,
      item.content,
      item.status,
      item.version,
      item.created_by,
      item.updated_by,
      item.created_at,
      item.updated_at,
      item.assignee_user_id,
      item.priority,
      item.channel,
      item.description,
      item.starts_at,
      item.due_at,
      item.metadata,
      item.completed_at,
      item.cancelled_at,
      campaign.name as campaign_name,
      coalesce(item.starts_at, item.due_at) as effective_at,
      case item.priority
        when 'urgent' then 4
        when 'high' then 3
        when 'normal' then 2
        else 1
      end as priority_rank,
      (
        item.due_at is not null
        and item.due_at < now()
        and item.status not in ('completed', 'cancelled')
      ) as is_overdue,
      exists (
        select 1
        from marketing_ops.item_dependencies as dependency
        join marketing_ops.campaign_items as predecessor
          on predecessor.tenant_id = dependency.tenant_id
          and predecessor.campaign_id = dependency.campaign_id
          and predecessor.id = dependency.depends_on_item_id
        where dependency.tenant_id = item.tenant_id
          and dependency.item_id = item.id
          and predecessor.status <> 'completed'
      ) as is_blocked
    from actor_context
    join marketing_ops.campaign_items as item
      on item.tenant_id = actor_context.tenant_id
    join marketing_ops.campaigns as campaign
      on campaign.tenant_id = item.tenant_id
      and campaign.id = item.campaign_id
    where actor_context.role is not null
      and (
        actor_context.role in ('manager', 'admin')
        or exists (
          select 1
          from marketing_ops.campaign_members as participant
          where participant.tenant_id = item.tenant_id
            and participant.campaign_id = item.campaign_id
            and participant.user_id = actor_context.user_id
        )
      )
      and (
        p_from is null
        or (
          coalesce(item.starts_at, item.due_at) < p_to
          and coalesce(item.due_at, item.starts_at) >= p_from
        )
      )
      and (p_campaign_id is null or item.campaign_id = p_campaign_id)
      and (p_kind is null or item.kind = p_kind)
      and (p_channel is null or item.channel = p_channel)
      and (p_assignee_user_id is null or item.assignee_user_id = p_assignee_user_id)
      and (p_status is null or item.status = p_status)
      and (p_priority is null or item.priority = p_priority)
  )
  select
    filtered_items.id,
    filtered_items.tenant_id,
    filtered_items.campaign_id,
    filtered_items.kind,
    filtered_items.title,
    filtered_items.content,
    filtered_items.status,
    filtered_items.version,
    filtered_items.created_by,
    filtered_items.updated_by,
    filtered_items.created_at,
    filtered_items.updated_at,
    filtered_items.assignee_user_id,
    filtered_items.priority,
    filtered_items.channel,
    filtered_items.description,
    filtered_items.starts_at,
    filtered_items.due_at,
    filtered_items.metadata,
    filtered_items.completed_at,
    filtered_items.cancelled_at,
    filtered_items.campaign_name,
    filtered_items.effective_at,
    filtered_items.is_overdue,
    filtered_items.is_blocked
  from filtered_items
  where (
    p_cursor_id is null
    or (
      p_cursor_effective_at is not null
      and (
        filtered_items.effective_at > p_cursor_effective_at
        or filtered_items.effective_at is null
        or (
          filtered_items.effective_at = p_cursor_effective_at
          and (
            filtered_items.priority_rank < p_cursor_priority_rank
            or (
              filtered_items.priority_rank = p_cursor_priority_rank
              and filtered_items.id > p_cursor_id
            )
          )
        )
      )
    )
    or (
      p_cursor_effective_at is null
      and filtered_items.effective_at is null
      and (
        filtered_items.priority_rank < p_cursor_priority_rank
        or (
          filtered_items.priority_rank = p_cursor_priority_rank
          and filtered_items.id > p_cursor_id
        )
      )
    )
  )
  order by
    filtered_items.effective_at asc nulls last,
    filtered_items.priority_rank desc,
    filtered_items.id asc
  limit greatest(1, least(coalesce(p_limit, 26), 101))
$$;

revoke all on function marketing_ops_private.list_production_schedule(
  timestamptz, timestamptz, uuid, marketing_ops.item_kind,
  marketing_ops.item_channel, uuid, marketing_ops.item_status,
  marketing_ops.item_priority, timestamptz, integer, uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.list_production_schedule(
  timestamptz, timestamptz, uuid, marketing_ops.item_kind,
  marketing_ops.item_channel, uuid, marketing_ops.item_status,
  marketing_ops.item_priority, timestamptz, integer, uuid, integer
) to authenticated;
