alter type marketing_ops.campaign_status add value if not exists 'planned' before 'archived';
alter type marketing_ops.campaign_status add value if not exists 'active' before 'archived';
alter type marketing_ops.campaign_status add value if not exists 'completed' before 'archived';

create type marketing_ops.reference_type as enum ('course', 'product', 'initiative');
create type marketing_ops.campaign_channel as enum (
  'email',
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'whatsapp',
  'site',
  'paid_media',
  'event',
  'other'
);

alter table marketing_ops.campaigns
  add column objective text,
  add column reference_type marketing_ops.reference_type,
  add column reference_key text,
  add column reference_title_snapshot text,
  add column reference_document_id uuid,
  add column reference_verified_at timestamptz,
  add column audience text,
  add column start_date date,
  add column end_date date,
  add column channels marketing_ops.campaign_channel[] not null default '{}',
  add column briefing text,
  add column notes text,
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A')
      || setweight(to_tsvector('simple'::regconfig, coalesce(objective, '')), 'B')
      || setweight(to_tsvector('simple'::regconfig, coalesce(reference_key, '')), 'A')
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
  add constraint campaigns_channels_limit check (cardinality(channels) <= 10),
  add constraint campaigns_period_valid check (
    start_date is null or end_date is null or end_date >= start_date
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
      and start_date is not null
      and end_date is not null
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
  on marketing_ops.campaigns (tenant_id, start_date, end_date)
  where start_date is not null and end_date is not null;

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
    having count(*) filter (where participant.is_primary) <> 1
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

create table marketing_ops.campaign_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  artifact_id uuid not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  source text not null default 'marketing_ops',
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
  constraint campaign_materials_source_not_blank check (btrim(source) <> ''),
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

create function marketing_ops_private.can_edit_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      marketing_ops_private.current_actor_role(campaign.tenant_id) in ('manager', 'admin')
      or exists (
        select 1
        from marketing_ops.campaign_members as participant
        where participant.campaign_id = campaign.id
          and participant.tenant_id = campaign.tenant_id
          and participant.user_id = (select auth.uid())
          and participant.member_role in ('owner', 'editor')
      )
    from marketing_ops.campaigns as campaign
    where campaign.id = p_campaign_id
      and campaign.tenant_id = marketing_ops_private.current_tenant_id()
  ), false)
$$;

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

revoke all on function marketing_ops_private.can_edit_campaign(uuid)
  from public, anon, authenticated, service_role;
grant execute on function marketing_ops_private.can_edit_campaign(uuid) to authenticated;

insert into marketing_ops.schema_versions (version, description)
values ('2026-07-phase-2-workspace', 'Marketing Ops operational workspace aggregate')
on conflict (version) do nothing;
