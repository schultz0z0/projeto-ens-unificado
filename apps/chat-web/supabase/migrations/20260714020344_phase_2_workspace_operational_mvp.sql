alter type marketing_ops.campaign_status add value if not exists 'planned' before 'archived';
alter type marketing_ops.campaign_status add value if not exists 'active' before 'archived';
alter type marketing_ops.campaign_status add value if not exists 'completed' before 'archived';

create type marketing_ops.reference_type as enum ('course', 'product', 'initiative');
create type marketing_ops.campaign_channel as enum (
  'email',
  'instagram',
  'linkedin',
  'facebook',
  'whatsapp',
  'website',
  'paid_media',
  'events',
  'press',
  'other'
);
create type marketing_ops.campaign_material_source as enum ('upload', 'existing_artifact');

create function marketing_ops_private.campaign_channels_are_valid(
  p_primary_channel marketing_ops.campaign_channel,
  p_secondary_channels marketing_ops.campaign_channel[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_secondary_channels is not null
    and cardinality(p_secondary_channels) <= 9
    and array_position(p_secondary_channels, null::marketing_ops.campaign_channel) is null
    and not exists (
      select 1
      from unnest(p_secondary_channels) as secondary_channel(channel)
      group by secondary_channel.channel
      having count(*) > 1
    )
    and (
      p_primary_channel is null
      or not (p_primary_channel = any (p_secondary_channels))
    )
$$;

revoke all on function marketing_ops_private.campaign_channels_are_valid(
  marketing_ops.campaign_channel,
  marketing_ops.campaign_channel[]
) from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.campaign_channels_are_valid(
  marketing_ops.campaign_channel,
  marketing_ops.campaign_channel[]
) to authenticated, service_role;

alter table marketing_ops.campaigns
  add column objective text,
  add column reference_type marketing_ops.reference_type,
  add column reference_key text,
  add column reference_title_snapshot text,
  add column reference_document_id uuid,
  add column reference_verified_at timestamptz,
  add column audience text,
  add column starts_on date,
  add column ends_on date,
  add column primary_channel marketing_ops.campaign_channel,
  add column secondary_channels marketing_ops.campaign_channel[] not null default '{}',
  add column briefing text,
  add column notes text,
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A')
      || setweight(to_tsvector('simple'::regconfig, coalesce(reference_title_snapshot, '')), 'A')
  ) stored,
  add constraint campaigns_name_length check (char_length(btrim(name)) between 1 and 200),
  add constraint campaigns_objective_length check (objective is null or char_length(btrim(objective)) <= 2000),
  add constraint campaigns_reference_key_length check (reference_key is null or char_length(btrim(reference_key)) <= 200),
  add constraint campaigns_reference_title_length check (
    reference_title_snapshot is null or char_length(btrim(reference_title_snapshot)) <= 300
  ),
  add constraint campaigns_audience_length check (audience is null or char_length(btrim(audience)) <= 2000),
  add constraint campaigns_briefing_length check (briefing is null or char_length(briefing) <= 20000),
  add constraint campaigns_notes_length check (notes is null or char_length(notes) <= 10000),
  add constraint campaigns_channels_consistent check (
    marketing_ops_private.campaign_channels_are_valid(primary_channel, secondary_channels)
  ),
  add constraint campaigns_period_valid check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  ),
  add constraint campaigns_reference_consistent check (
    (reference_document_id is null or reference_type = 'course')
    and (
      reference_verified_at is null
      or (reference_type = 'course' and reference_document_id is not null)
    )
  ),
  add constraint campaigns_planning_fields_required check (
    status::text not in ('planned', 'active', 'completed')
    or (
      objective is not null
      and btrim(objective) <> ''
      and reference_type is not null
      and reference_title_snapshot is not null
      and btrim(reference_title_snapshot) <> ''
      and starts_on is not null
      and ends_on is not null
      and (
        reference_type <> 'course'
        or (
          reference_key is not null
          and btrim(reference_key) <> ''
          and reference_document_id is not null
          and reference_verified_at is not null
        )
      )
    )
  );

create index campaigns_tenant_search_idx
  on marketing_ops.campaigns using gin (search_vector);
create index campaigns_tenant_reference_idx
  on marketing_ops.campaigns (tenant_id, reference_type, reference_key)
  where reference_type is not null;
create index campaigns_tenant_period_idx
  on marketing_ops.campaigns (tenant_id, starts_on, ends_on)
  where starts_on is not null and ends_on is not null;

alter table marketing_ops.campaign_members
  add column is_primary boolean not null default false,
  add constraint campaign_members_primary_owner check (not is_primary or member_role = 'owner');

with ranked_owners as (
  select
    participant.campaign_id,
    participant.user_id,
    row_number() over (
      partition by participant.campaign_id
      order by
        (participant.user_id = campaign.created_by) desc,
        participant.created_at,
        participant.user_id
    ) as owner_rank
  from marketing_ops.campaign_members as participant
  join marketing_ops.campaigns as campaign on campaign.id = participant.campaign_id
  where participant.member_role = 'owner'
)
update marketing_ops.campaign_members as participant
set is_primary = true
from ranked_owners
where ranked_owners.campaign_id = participant.campaign_id
  and ranked_owners.user_id = participant.user_id
  and ranked_owners.owner_rank = 1;

do $$
begin
  if exists (
    select 1
    from marketing_ops.campaigns as campaign
    left join marketing_ops.campaign_members as participant
      on participant.campaign_id = campaign.id
    group by campaign.id
    having count(*) filter (
      where participant.is_primary and participant.member_role = 'owner'
    ) <> 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'every existing campaign must have exactly one primary owner';
  end if;
end;
$$;

create unique index campaign_members_one_primary_idx
  on marketing_ops.campaign_members (campaign_id)
  where is_primary;

create function marketing_ops_private.promote_first_campaign_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.member_role = 'owner'
    and not new.is_primary
    and (
      tg_op = 'INSERT'
      or old.member_role <> 'owner'
      or old.campaign_id <> new.campaign_id
    )
    and not exists (
      select 1
      from marketing_ops.campaign_members as participant
      where participant.campaign_id = new.campaign_id
        and participant.tenant_id = new.tenant_id
        and participant.is_primary
        and (
          tg_op = 'INSERT'
          or (participant.campaign_id, participant.user_id)
            <> (old.campaign_id, old.user_id)
        )
    )
  then
    new.is_primary := true;
  end if;

  return new;
end;
$$;

create function marketing_ops_private.assert_campaign_primary_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_campaign_ids uuid[];
  target_tenant_ids uuid[];
  target_index integer;
  primary_owner_count integer;
begin
  if tg_table_name = 'campaigns' then
    target_campaign_ids := array[new.id];
    target_tenant_ids := array[new.tenant_id];
  elsif tg_op = 'DELETE' then
    target_campaign_ids := array[old.campaign_id];
    target_tenant_ids := array[old.tenant_id];
  elsif tg_op = 'UPDATE' then
    target_campaign_ids := array[new.campaign_id];
    target_tenant_ids := array[new.tenant_id];
    if (old.campaign_id, old.tenant_id) is distinct from (new.campaign_id, new.tenant_id) then
      target_campaign_ids := array_append(target_campaign_ids, old.campaign_id);
      target_tenant_ids := array_append(target_tenant_ids, old.tenant_id);
    end if;
  else
    target_campaign_ids := array[new.campaign_id];
    target_tenant_ids := array[new.tenant_id];
  end if;

  for target_index in 1..cardinality(target_campaign_ids) loop
    if exists (
      select 1
      from marketing_ops.campaigns as campaign
      where campaign.id = target_campaign_ids[target_index]
        and campaign.tenant_id = target_tenant_ids[target_index]
    ) then
      select count(*)::integer
      into primary_owner_count
      from marketing_ops.campaign_members as participant
      where participant.campaign_id = target_campaign_ids[target_index]
        and participant.tenant_id = target_tenant_ids[target_index]
        and participant.is_primary
        and participant.member_role = 'owner';

      if primary_owner_count <> 1 then
        raise exception using
          errcode = '23514',
          message = format(
            'campaign %s must have exactly one primary owner',
            target_campaign_ids[target_index]
          );
      end if;
    end if;
  end loop;

  return null;
end;
$$;

create trigger campaign_members_promote_first_owner
before insert or update on marketing_ops.campaign_members
for each row execute function marketing_ops_private.promote_first_campaign_owner();

create trigger campaign_members_serialize_delete
before delete on marketing_ops.campaign_members
for each row execute function marketing_ops_private.promote_first_campaign_owner();

create constraint trigger campaign_members_require_primary_owner
after insert or update or delete on marketing_ops.campaign_members
deferrable initially deferred
for each row execute function marketing_ops_private.assert_campaign_primary_owner();

create constraint trigger campaigns_require_primary_owner
after insert or update on marketing_ops.campaigns
deferrable initially deferred
for each row execute function marketing_ops_private.assert_campaign_primary_owner();

create table marketing_ops.campaign_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  artifact_id uuid not null,
  artifact_owner_id text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  source marketing_ops.campaign_material_source not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unlinked_by uuid,
  unlinked_at timestamptz,
  constraint campaign_materials_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint campaign_materials_created_by_fk foreign key (created_by) references auth.users(id),
  constraint campaign_materials_unlinked_by_fk foreign key (unlinked_by) references auth.users(id),
  constraint campaign_materials_filename_not_blank check (btrim(filename) <> ''),
  constraint campaign_materials_content_type_not_blank check (btrim(content_type) <> ''),
  constraint campaign_materials_artifact_owner check (
    btrim(artifact_owner_id) <> '' and char_length(artifact_owner_id) <= 200
  ),
  constraint campaign_materials_size check (size_bytes between 1 and 26214400),
  constraint campaign_materials_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint campaign_materials_unlink_consistent check ((unlinked_at is null) = (unlinked_by is null))
);

create index campaign_materials_campaign_idx
  on marketing_ops.campaign_materials (tenant_id, campaign_id);
create index campaign_materials_created_by_idx
  on marketing_ops.campaign_materials (created_by);
create index campaign_materials_unlinked_by_idx
  on marketing_ops.campaign_materials (unlinked_by)
  where unlinked_by is not null;
create index campaign_materials_campaign_active_idx
  on marketing_ops.campaign_materials (tenant_id, campaign_id, created_at desc, id)
  where unlinked_at is null;

create function marketing_ops_private.lock_campaign_aggregate(p_campaign_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_campaign_id is null or (select auth.uid()) is null then
    return false;
  end if;

  if not exists (
    select 1
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
      and campaign.status <> 'archived'
      and (
        marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
        or (
          marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
          and exists (
            select 1
            from marketing_ops.campaign_members as participant
            where participant.campaign_id = campaign.id
              and participant.tenant_id = campaign.tenant_id
              and participant.user_id = (select auth.uid())
              and participant.member_role in ('owner', 'editor')
          )
        )
        or (
          marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
          and campaign.status = 'draft'
          and campaign.created_by = (select auth.uid())
          and not exists (
            select 1
            from marketing_ops.campaign_members as participant
            where participant.campaign_id = campaign.id
              and participant.tenant_id = campaign.tenant_id
          )
        )
      )
  ) then
    return false;
  end if;

  -- Advisory locks expose 64-bit keys while campaign ids are 128-bit UUIDs.
  -- A hash collision can only serialize unrelated campaigns: authorization and
  -- every data lookup still use the original UUID and tenant predicates.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marketing_ops.campaign:' || p_campaign_id::text, 0)
  );
  return true;
end;
$$;

create or replace function marketing_ops_private.can_manage_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not coalesce((
    select
      campaign.status <> 'archived'
      and (
        marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
        or (
          marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
          and exists (
            select 1
            from marketing_ops.campaign_members as participant
            where participant.campaign_id = campaign.id
              and participant.tenant_id = campaign.tenant_id
              and participant.user_id = (select auth.uid())
              and participant.member_role = 'owner'
              and participant.is_primary
          )
        )
      )
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false) then
    return false;
  end if;

  if not marketing_ops_private.lock_campaign_aggregate(p_campaign_id) then
    return false;
  end if;

  return coalesce((
    select
      campaign.status <> 'archived'
      and (
        marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
        or (
          marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
          and exists (
            select 1
            from marketing_ops.campaign_members as participant
            where participant.campaign_id = campaign.id
              and participant.tenant_id = campaign.tenant_id
              and participant.user_id = (select auth.uid())
              and participant.member_role = 'owner'
              and participant.is_primary
          )
        )
      )
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false);
end;
$$;

create function marketing_ops_private.can_administer_campaign_participants(p_campaign_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not coalesce((
    select
      campaign.status <> 'archived'
      and marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false) then
    return false;
  end if;

  if not marketing_ops_private.lock_campaign_aggregate(p_campaign_id) then
    return false;
  end if;

  return coalesce((
    select
      campaign.status <> 'archived'
      and marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false);
end;
$$;

create function marketing_ops_private.can_bootstrap_campaign_owner(
  p_campaign_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not marketing_ops_private.lock_campaign_aggregate(p_campaign_id) then
    return false;
  end if;

  return coalesce((
    select
      campaign.created_by = (select auth.uid())
      and p_user_id = (select auth.uid())
      and campaign.status = 'draft'
      and marketing_ops_private.current_actor_role(campaign.tenant_id) is not null
      and not exists (
        select 1
        from marketing_ops.campaign_members as participant
        where participant.campaign_id = campaign.id
          and participant.tenant_id = campaign.tenant_id
      )
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false);
end;
$$;

create function marketing_ops_private.can_edit_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not marketing_ops_private.lock_campaign_aggregate(p_campaign_id) then
    return false;
  end if;

  return coalesce((
    select
      campaign.status <> 'archived'
      and (
        marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
        or (
          marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
          and exists (
            select 1
            from marketing_ops.campaign_members as participant
            where participant.campaign_id = campaign.id
              and participant.tenant_id = campaign.tenant_id
              and participant.user_id = (select auth.uid())
              and participant.member_role in ('owner', 'editor')
          )
        )
      )
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false);
end;
$$;

create function marketing_ops_private.enforce_campaign_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role marketing_ops.membership_role;
  is_forward_transition boolean;
  is_reopen_transition boolean;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if old.status = 'archived' then
    raise exception using
      errcode = '42501',
      message = 'archived campaign is read-only';
  end if;

  if new.version <> old.version + 1 then
    raise exception using
      errcode = '42501',
      message = 'authenticated campaign update must increment version by one';
  end if;

  if new.status = old.status then
    return new;
  end if;

  actor_role := marketing_ops_private.current_actor_role(old.tenant_id);
  is_forward_transition := (old.status::text, new.status::text) in (
    ('draft', 'planned'),
    ('planned', 'active'),
    ('active', 'completed')
  );
  is_reopen_transition := (old.status::text, new.status::text) in (
    ('planned', 'draft'),
    ('active', 'planned'),
    ('completed', 'active')
  );

  if is_forward_transition
    and marketing_ops_private.can_manage_campaign(old.id)
  then
    return new;
  end if;

  if is_reopen_transition
    and actor_role in ('manager', 'admin')
  then
    return new;
  end if;

  if new.status = 'archived'
    and actor_role in ('manager', 'admin')
  then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = format('campaign status transition %s -> %s is not allowed', old.status, new.status);
end;
$$;

create function marketing_ops_private.list_campaign_participants(p_campaign_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  member_role marketing_ops.campaign_member_role,
  is_primary boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    participant.user_id,
    case
      when nullif(pg_catalog.btrim(profile.full_name), '') is not null
        and pg_catalog.lower(pg_catalog.btrim(profile.full_name)) is distinct from
          pg_catalog.lower(nullif(pg_catalog.btrim(profile.email), ''))
        and pg_catalog.strpos(pg_catalog.btrim(profile.full_name), '@') = 0
      then pg_catalog.btrim(profile.full_name)
      else 'Usuario ' || pg_catalog.left(participant.user_id::text, 8)
    end as display_name,
    profile.avatar_url,
    participant.member_role,
    participant.is_primary
  from marketing_ops.campaign_members as participant
  left join public.profiles as profile on profile.id = participant.user_id
  where participant.campaign_id = p_campaign_id
    and participant.tenant_id = marketing_ops_private.current_tenant_id()
    and marketing_ops_private.can_access_campaign(p_campaign_id)
  order by participant.is_primary desc, participant.member_role, display_name, participant.user_id
$$;

create function marketing_ops_private.list_campaign_participant_candidates(
  p_campaign_id uuid,
  p_query text default null,
  p_limit integer default 25
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  tenant_role marketing_ops.membership_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.user_id,
    case
      when nullif(pg_catalog.btrim(profile.full_name), '') is not null
        and pg_catalog.lower(pg_catalog.btrim(profile.full_name)) is distinct from
          pg_catalog.lower(nullif(pg_catalog.btrim(profile.email), ''))
        and pg_catalog.strpos(pg_catalog.btrim(profile.full_name), '@') = 0
      then pg_catalog.btrim(profile.full_name)
      else 'Usuario ' || pg_catalog.left(membership.user_id::text, 8)
    end as display_name,
    profile.avatar_url,
    membership.role as tenant_role
  from marketing_ops.memberships as membership
  join marketing_ops.campaigns as campaign
    on campaign.id = p_campaign_id
    and campaign.tenant_id = membership.tenant_id
  left join public.profiles as profile on profile.id = membership.user_id
  where membership.tenant_id = marketing_ops_private.current_tenant_id()
    and membership.active
    and campaign.status <> 'archived'
    and (
      marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
      or (
        marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
        and exists (
          select 1
          from marketing_ops.campaign_members as actor_participant
          where actor_participant.campaign_id = campaign.id
            and actor_participant.tenant_id = campaign.tenant_id
            and actor_participant.user_id = (select auth.uid())
            and actor_participant.member_role = 'owner'
            and actor_participant.is_primary
        )
      )
    )
    and not exists (
      select 1
      from marketing_ops.campaign_members as participant
      where participant.campaign_id = campaign.id
        and participant.tenant_id = campaign.tenant_id
        and participant.user_id = membership.user_id
    )
    and (
      nullif(pg_catalog.btrim(p_query), '') is null
      or pg_catalog.strpos(
        pg_catalog.lower(
          case
            when nullif(pg_catalog.btrim(profile.full_name), '') is not null
              and pg_catalog.lower(pg_catalog.btrim(profile.full_name)) is distinct from
                pg_catalog.lower(nullif(pg_catalog.btrim(profile.email), ''))
              and pg_catalog.strpos(pg_catalog.btrim(profile.full_name), '@') = 0
            then pg_catalog.btrim(profile.full_name)
            else membership.user_id::text
          end
        ),
        pg_catalog.lower(pg_catalog.btrim(p_query))
      ) > 0
    )
  order by display_name, membership.user_id
  limit pg_catalog.greatest(1, pg_catalog.least(coalesce(p_limit, 25), 100))
$$;

create function marketing_ops_private.is_campaign_participant_candidate(
  p_campaign_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      campaign.status <> 'archived'
      and membership.active
      and (
        marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
        or (
          marketing_ops_private.current_actor_role(campaign.tenant_id) = 'member'
          and exists (
            select 1
            from marketing_ops.campaign_members as actor_participant
            where actor_participant.campaign_id = campaign.id
              and actor_participant.tenant_id = campaign.tenant_id
              and actor_participant.user_id = (select auth.uid())
              and actor_participant.member_role = 'owner'
              and actor_participant.is_primary
          )
        )
      )
      and not exists (
        select 1
        from marketing_ops.campaign_members as participant
        where participant.campaign_id = campaign.id
          and participant.tenant_id = campaign.tenant_id
          and participant.user_id = membership.user_id
      )
    from marketing_ops.campaigns as campaign
    join marketing_ops.memberships as membership
      on membership.tenant_id = campaign.tenant_id
      and membership.user_id = p_user_id
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false)
$$;

create function marketing_ops_private.enforce_campaign_item_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if old.status <> 'draft' or new.status <> 'draft' then
    raise exception using
      errcode = '42501',
      message = 'archived campaign item is read-only';
  end if;

  if new.version <> old.version + 1 then
    raise exception using
      errcode = '42501',
      message = 'authenticated campaign item update must increment version by one';
  end if;

  return new;
end;
$$;

create trigger campaigns_enforce_authenticated_update
before update on marketing_ops.campaigns
for each row execute function marketing_ops_private.enforce_campaign_update();

create trigger campaign_items_enforce_authenticated_update
before update on marketing_ops.campaign_items
for each row execute function marketing_ops_private.enforce_campaign_item_update();

drop policy campaigns_update on marketing_ops.campaigns;

create policy campaigns_update on marketing_ops.campaigns
for update to authenticated
using (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_edit_campaign(id))
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and updated_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign(id))
);

drop policy campaign_members_insert on marketing_ops.campaign_members;
drop policy campaign_members_update on marketing_ops.campaign_members;
drop policy campaign_members_delete on marketing_ops.campaign_members;

create policy campaign_members_insert on marketing_ops.campaign_members
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and created_by = (select auth.uid())
  and (
    (select marketing_ops_private.can_administer_campaign_participants(campaign_id))
    or (
      (select marketing_ops_private.can_manage_campaign(campaign_id))
      and member_role in ('viewer', 'editor')
      and not is_primary
    )
    or (
      member_role = 'owner'
      and is_primary
      and user_id = (select auth.uid())
      and (select marketing_ops_private.can_bootstrap_campaign_owner(campaign_id, user_id))
    )
  )
);

create policy campaign_members_update on marketing_ops.campaign_members
for update to authenticated
using (
  (select marketing_ops_private.can_administer_campaign_participants(campaign_id))
  or (
    (select marketing_ops_private.can_manage_campaign(campaign_id))
    and member_role in ('viewer', 'editor')
    and not is_primary
  )
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (
    (select marketing_ops_private.can_administer_campaign_participants(campaign_id))
    or (
      (select marketing_ops_private.can_manage_campaign(campaign_id))
      and member_role in ('viewer', 'editor')
      and not is_primary
    )
  )
);

create policy campaign_members_delete on marketing_ops.campaign_members
for delete to authenticated
using (
  (select marketing_ops_private.can_administer_campaign_participants(campaign_id))
  or (
    (select marketing_ops_private.can_manage_campaign(campaign_id))
    and member_role in ('viewer', 'editor')
    and not is_primary
  )
);

drop policy campaign_items_insert on marketing_ops.campaign_items;
drop policy campaign_items_update on marketing_ops.campaign_items;

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
  and status = 'draft'
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and status = 'draft'
  and updated_by = (select auth.uid())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
);

alter table marketing_ops.campaign_materials enable row level security;
alter table marketing_ops.campaign_materials force row level security;

create policy campaign_materials_select on marketing_ops.campaign_materials
for select to authenticated
using ((select marketing_ops_private.can_access_campaign(campaign_id)));

create policy campaign_materials_insert on marketing_ops.campaign_materials
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
  and created_by = (select auth.uid())
  and unlinked_by is null
  and unlinked_at is null
);

create policy campaign_materials_update on marketing_ops.campaign_materials
for update to authenticated
using (
  unlinked_at is null
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
)
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (select marketing_ops_private.can_edit_campaign(campaign_id))
  and unlinked_by = (select auth.uid())
  and unlinked_at is not null
);

revoke all on table marketing_ops.campaign_materials from public, anon, authenticated, service_role;
grant select, insert on table marketing_ops.campaign_materials to authenticated;
grant update (unlinked_by, unlinked_at) on table marketing_ops.campaign_materials to authenticated;
grant all on table marketing_ops.campaign_materials to service_role;

revoke update on table marketing_ops.campaigns from authenticated;
grant update (
  name,
  status,
  version,
  updated_by,
  archived_at,
  course_slug,
  objective,
  reference_type,
  reference_key,
  reference_title_snapshot,
  reference_document_id,
  reference_verified_at,
  audience,
  starts_on,
  ends_on,
  primary_channel,
  secondary_channels,
  briefing,
  notes
) on marketing_ops.campaigns to authenticated;

revoke insert on table marketing_ops.campaigns from authenticated;
grant insert (
  id,
  tenant_id,
  name,
  course_slug,
  objective,
  reference_type,
  reference_key,
  reference_title_snapshot,
  reference_document_id,
  reference_verified_at,
  audience,
  starts_on,
  ends_on,
  primary_channel,
  secondary_channels,
  briefing,
  notes,
  created_by,
  updated_by
) on marketing_ops.campaigns to authenticated;

revoke insert, update on table marketing_ops.campaign_members from authenticated;
grant insert (
  tenant_id,
  campaign_id,
  user_id,
  member_role,
  is_primary,
  created_by
) on marketing_ops.campaign_members to authenticated;
grant update (
  member_role,
  is_primary
) on marketing_ops.campaign_members to authenticated;

revoke insert, update on table marketing_ops.campaign_items from authenticated;
grant insert (
  tenant_id,
  campaign_id,
  kind,
  title,
  content,
  created_by,
  updated_by
) on marketing_ops.campaign_items to authenticated;
grant update (
  title,
  content,
  version,
  updated_by
) on marketing_ops.campaign_items to authenticated;

create function marketing_ops_private.list_campaign_timeline(
  p_campaign_id uuid,
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  action text,
  occurred_at timestamptz,
  actor_display_name text,
  origin marketing_ops.origin_type,
  changes jsonb,
  correlation_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    audit.id,
    case
      when audit.action = any (array[
        'campaign.created',
        'campaign.updated',
        'campaign.status_changed',
        'campaign.archived',
        'participant.added',
        'participant.updated',
        'participant.removed',
        'material.linked',
        'material.unlinked'
      ]::text[]) then audit.action
      else 'campaign.changed'
    end as action,
    audit.created_at as occurred_at,
    case
      when nullif(pg_catalog.btrim(profile.full_name), '') is not null
        and pg_catalog.lower(pg_catalog.btrim(profile.full_name)) is distinct from
          pg_catalog.lower(nullif(pg_catalog.btrim(profile.email), ''))
        and pg_catalog.strpos(pg_catalog.btrim(profile.full_name), '@') = 0
      then pg_catalog.btrim(profile.full_name)
      else 'Usuario ' || pg_catalog.left(audit.actor_user_id::text, 8)
    end as actor_display_name,
    audit.origin,
    change_set.changes,
    audit.correlation_id
  from marketing_ops.audit_events as audit
  left join public.profiles as profile on profile.id = audit.actor_user_id
  cross join lateral (
    select
      case
        when pg_catalog.jsonb_typeof(audit.before_state) = 'object' then audit.before_state
        else '{}'::jsonb
      end as before_object,
      case
        when pg_catalog.jsonb_typeof(audit.after_state) = 'object' then audit.after_state
        else '{}'::jsonb
      end as after_object
  ) as snapshots
  cross join lateral (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'field', changed.field,
          'kind', changed.kind
        ) order by changed.field
      ),
      '[]'::jsonb
    ) as changes
    from (
      select
        fields.field,
        case
          when not (snapshots.before_object ? fields.field) then 'added'
          when not (snapshots.after_object ? fields.field) then 'removed'
          else 'changed'
        end as kind
      from pg_catalog.jsonb_object_keys(
        snapshots.before_object || snapshots.after_object
      ) as fields(field)
      where snapshots.before_object -> fields.field
        is distinct from snapshots.after_object -> fields.field
        and fields.field = any (array[
          'name',
          'courseSlug',
          'objective',
          'referenceType',
          'referenceKey',
          'referenceTitleSnapshot',
          'referenceDocumentId',
          'referenceVerifiedAt',
          'audience',
          'startsOn',
          'endsOn',
          'primaryChannel',
          'secondaryChannels',
          'briefing',
          'notes',
          'status',
          'archivedAt',
          'participant',
          'userId',
          'memberRole',
          'isPrimary',
          'material',
          'materialId',
          'artifactId'
        ]::text[])
    ) as changed
  ) as change_set
  where audit.tenant_id = marketing_ops_private.current_tenant_id()
    and audit.entity_type = 'campaign'
    and audit.entity_id = p_campaign_id
    and marketing_ops_private.can_access_campaign(p_campaign_id)
    and (
      p_before_created_at is null
      or (
        p_before_id is not null
        and (audit.created_at, audit.id) < (p_before_created_at, p_before_id)
      )
    )
  order by audit.created_at desc, audit.id desc
  limit pg_catalog.greatest(1, pg_catalog.least(coalesce(p_limit, 25), 101))
$$;

revoke all on function marketing_ops_private.can_edit_campaign(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_edit_campaign(uuid) to authenticated;

revoke all on function marketing_ops_private.lock_campaign_aggregate(uuid)
  from public, anon, authenticated, service_role;

revoke all on function marketing_ops_private.can_manage_campaign(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_manage_campaign(uuid) to authenticated;

revoke all on function marketing_ops_private.can_administer_campaign_participants(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_administer_campaign_participants(uuid) to authenticated;

revoke all on function marketing_ops_private.can_bootstrap_campaign_owner(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_bootstrap_campaign_owner(uuid, uuid) to authenticated;

revoke all on function marketing_ops_private.promote_first_campaign_owner()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.assert_campaign_primary_owner()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.enforce_campaign_update()
  from public, anon, authenticated, service_role;
revoke all on function marketing_ops_private.enforce_campaign_item_update()
  from public, anon, authenticated, service_role;

revoke all on function marketing_ops_private.list_campaign_participants(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.list_campaign_participants(uuid) to authenticated;

revoke all on function marketing_ops_private.list_campaign_participant_candidates(uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.list_campaign_participant_candidates(uuid, text, integer)
  to authenticated;

revoke all on function marketing_ops_private.is_campaign_participant_candidate(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.is_campaign_participant_candidate(uuid, uuid)
  to authenticated;

revoke all on function marketing_ops_private.list_campaign_timeline(uuid, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.list_campaign_timeline(uuid, integer, timestamptz, uuid)
  to authenticated;

insert into marketing_ops.schema_versions (version, description)
values ('2026-07-phase-2-workspace', 'Marketing Ops operational workspace aggregate')
on conflict (version) do nothing;
