create function marketing_ops_private.lock_item_dependency_pair(
  p_item_id uuid,
  p_depends_on_item_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  first_id uuid;
  second_id uuid;
begin
  if p_item_id is null or p_depends_on_item_id is null then
    raise exception using
      errcode = '23502',
      message = 'Dependency item identifiers are required';
  end if;

  first_id := least(p_item_id, p_depends_on_item_id);
  second_id := greatest(p_item_id, p_depends_on_item_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(first_id::text, 320260718)
  );
  if second_id <> first_id then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(second_id::text, 320260718)
    );
  end if;
end
$$;

create function marketing_ops_private.enforce_item_dependency_graph()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  dependent record;
  predecessor record;
  creates_cycle boolean;
begin
  if tg_op = 'DELETE' then
    if (select auth.uid()) is not null
      and not marketing_ops_private.can_edit_campaign(old.campaign_id)
    then
      raise exception using
        errcode = '42501',
        message = 'Campaign does not grant dependency authority';
    end if;
    perform marketing_ops_private.lock_item_dependency_pair(
      old.item_id,
      old.depends_on_item_id
    );
    return old;
  end if;

  if (select auth.uid()) is not null
    and not marketing_ops_private.can_edit_campaign(new.campaign_id)
  then
    raise exception using
      errcode = '42501',
      message = 'Campaign does not grant dependency authority';
  end if;
  perform marketing_ops_private.lock_item_dependency_pair(
    new.item_id,
    new.depends_on_item_id
  );

  if new.item_id = new.depends_on_item_id then
    raise exception using
      errcode = '23514',
      constraint = 'item_dependencies_not_self',
      message = 'An item cannot depend on itself';
  end if;

  select item.tenant_id, item.campaign_id, item.status
  into dependent
  from marketing_ops.campaign_items as item
  where item.id = new.item_id;

  select item.tenant_id, item.campaign_id, item.status
  into predecessor
  from marketing_ops.campaign_items as item
  where item.id = new.depends_on_item_id;

  if dependent is null or predecessor is null then
    return new;
  end if;

  if
    dependent.tenant_id <> new.tenant_id
    or predecessor.tenant_id <> new.tenant_id
    or dependent.campaign_id <> new.campaign_id
    or predecessor.campaign_id <> new.campaign_id
  then
    raise exception using
      errcode = '23514',
      constraint = 'item_dependencies_same_campaign',
      message = 'Dependencies must stay in the same tenant and campaign';
  end if;

  if
    dependent.status in ('completed', 'cancelled')
    or predecessor.status in ('completed', 'cancelled')
  then
    raise exception using
      errcode = '23514',
      constraint = 'item_dependencies_active_items',
      message = 'Dependencies require nonterminal items';
  end if;

  with recursive reachable(item_id) as (
    select new.depends_on_item_id
    union
    select dependency.depends_on_item_id
    from marketing_ops.item_dependencies as dependency
    join reachable
      on reachable.item_id = dependency.item_id
    where dependency.tenant_id = new.tenant_id
      and dependency.campaign_id = new.campaign_id
  )
  select exists (
    select 1
    from reachable
    where item_id = new.item_id
  )
  into creates_cycle;

  if creates_cycle then
    raise exception using
      errcode = '23514',
      constraint = 'item_dependencies_acyclic',
      message = 'Dependency edge would create a cycle';
  end if;

  return new;
end
$$;

create trigger item_dependencies_enforce_graph
before insert or delete on marketing_ops.item_dependencies
for each row execute function marketing_ops_private.enforce_item_dependency_graph();

revoke all on function marketing_ops_private.lock_item_dependency_pair(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.enforce_item_dependency_graph()
  from public, anon, authenticated, service_role;
