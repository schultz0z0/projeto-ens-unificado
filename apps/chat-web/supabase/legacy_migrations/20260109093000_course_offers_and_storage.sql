-- Tabelas e policies para Ofertas (Modalidades, Parcerias e Ofertas)

-- 1) Tabelas base
create table if not exists public.course_modalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists course_modalities_name_ci_key
  on public.course_modalities (lower(name));

create table if not exists public.course_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  logo_url text,
  logo_path text,
  created_at timestamptz not null default now()
);

create unique index if not exists course_partners_name_ci_key
  on public.course_partners (lower(name));

create table if not exists public.course_offers (
  id uuid primary key default gen_random_uuid(),
  modality_id uuid references public.course_modalities (id) on delete set null,
  course_name text not null,
  description text,
  extra_info text,
  target_audience text,
  format text,
  workload_hours integer,
  duration_value integer,
  duration_unit text,
  course_start_date date,
  enrollment_start_date date,
  enrollment_end_date date,
  price_full numeric(12,2),
  offer_logo_url text,
  offer_logo_path text,
  created_at timestamptz not null default now(),
  constraint course_offers_format_check check (
    format is null or format in ('online_async','online_live','presencial','hibrido')
  ),
  constraint course_offers_duration_unit_check check (
    duration_unit is null or duration_unit in ('weeks','months')
  ),
  constraint course_offers_workload_hours_check check (workload_hours is null or workload_hours >= 0),
  constraint course_offers_duration_value_check check (duration_value is null or duration_value >= 0),
  constraint course_offers_price_full_check check (price_full is null or price_full >= 0),
  constraint course_offers_enrollment_dates_check check (
    enrollment_start_date is null
    or enrollment_end_date is null
    or enrollment_end_date >= enrollment_start_date
  )
);

create index if not exists course_offers_modality_id_idx
  on public.course_offers (modality_id);

-- 2) Tabelas filhas
create table if not exists public.offer_discounts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.course_offers (id) on delete cascade,
  starts_at date not null,
  ends_at date not null,
  percent numeric(5,2) not null,
  discounted_price numeric(12,2),
  created_at timestamptz not null default now(),
  constraint offer_discounts_date_check check (ends_at >= starts_at),
  constraint offer_discounts_percent_check check (percent >= 0 and percent <= 100),
  constraint offer_discounts_discounted_price_check check (discounted_price is null or discounted_price >= 0)
);

create index if not exists offer_discounts_offer_id_idx
  on public.offer_discounts (offer_id);

create table if not exists public.offer_modules (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.course_offers (id) on delete cascade,
  sort_order integer not null default 0,
  title text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists offer_modules_offer_id_idx
  on public.offer_modules (offer_id);

create table if not exists public.offer_partners (
  offer_id uuid not null references public.course_offers (id) on delete cascade,
  partner_id uuid not null references public.course_partners (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, partner_id)
);

create index if not exists offer_partners_partner_id_idx
  on public.offer_partners (partner_id);

-- 3) RLS
alter table public.course_modalities enable row level security;
alter table public.course_partners enable row level security;
alter table public.course_offers enable row level security;
alter table public.offer_discounts enable row level security;
alter table public.offer_modules enable row level security;
alter table public.offer_partners enable row level security;

drop policy if exists "Course modalities read" on public.course_modalities;
drop policy if exists "Course modalities insert" on public.course_modalities;
drop policy if exists "Course modalities update" on public.course_modalities;
drop policy if exists "Course modalities delete" on public.course_modalities;

create policy "Course modalities read" on public.course_modalities
  for select to authenticated using (true);
create policy "Course modalities insert" on public.course_modalities
  for insert to authenticated with check (true);
create policy "Course modalities update" on public.course_modalities
  for update to authenticated using (true) with check (true);
create policy "Course modalities delete" on public.course_modalities
  for delete to authenticated using (true);

drop policy if exists "Course partners read" on public.course_partners;
drop policy if exists "Course partners insert" on public.course_partners;
drop policy if exists "Course partners update" on public.course_partners;
drop policy if exists "Course partners delete" on public.course_partners;

create policy "Course partners read" on public.course_partners
  for select to authenticated using (true);
create policy "Course partners insert" on public.course_partners
  for insert to authenticated with check (true);
create policy "Course partners update" on public.course_partners
  for update to authenticated using (true) with check (true);
create policy "Course partners delete" on public.course_partners
  for delete to authenticated using (true);

drop policy if exists "Course offers read" on public.course_offers;
drop policy if exists "Course offers insert" on public.course_offers;
drop policy if exists "Course offers update" on public.course_offers;
drop policy if exists "Course offers delete" on public.course_offers;

create policy "Course offers read" on public.course_offers
  for select to authenticated using (true);
create policy "Course offers insert" on public.course_offers
  for insert to authenticated with check (true);
create policy "Course offers update" on public.course_offers
  for update to authenticated using (true) with check (true);
create policy "Course offers delete" on public.course_offers
  for delete to authenticated using (true);

drop policy if exists "Offer discounts read" on public.offer_discounts;
drop policy if exists "Offer discounts insert" on public.offer_discounts;
drop policy if exists "Offer discounts update" on public.offer_discounts;
drop policy if exists "Offer discounts delete" on public.offer_discounts;

create policy "Offer discounts read" on public.offer_discounts
  for select to authenticated using (true);
create policy "Offer discounts insert" on public.offer_discounts
  for insert to authenticated with check (true);
create policy "Offer discounts update" on public.offer_discounts
  for update to authenticated using (true) with check (true);
create policy "Offer discounts delete" on public.offer_discounts
  for delete to authenticated using (true);

drop policy if exists "Offer modules read" on public.offer_modules;
drop policy if exists "Offer modules insert" on public.offer_modules;
drop policy if exists "Offer modules update" on public.offer_modules;
drop policy if exists "Offer modules delete" on public.offer_modules;

create policy "Offer modules read" on public.offer_modules
  for select to authenticated using (true);
create policy "Offer modules insert" on public.offer_modules
  for insert to authenticated with check (true);
create policy "Offer modules update" on public.offer_modules
  for update to authenticated using (true) with check (true);
create policy "Offer modules delete" on public.offer_modules
  for delete to authenticated using (true);

drop policy if exists "Offer partners read" on public.offer_partners;
drop policy if exists "Offer partners insert" on public.offer_partners;
drop policy if exists "Offer partners delete" on public.offer_partners;

create policy "Offer partners read" on public.offer_partners
  for select to authenticated using (true);
create policy "Offer partners insert" on public.offer_partners
  for insert to authenticated with check (true);
create policy "Offer partners delete" on public.offer_partners
  for delete to authenticated using (true);

-- 4) Storage: buckets e policies
insert into storage.buckets (id, name, public)
values ('partners-logos', 'partners-logos', true), ('offers-logos', 'offers-logos', true)
on conflict (id) do nothing;

drop policy if exists "Public read partners logos" on storage.objects;
drop policy if exists "Authenticated upload partners logos" on storage.objects;
drop policy if exists "Authenticated update partners logos" on storage.objects;
drop policy if exists "Authenticated delete partners logos" on storage.objects;

create policy "Public read partners logos" on storage.objects
  for select to public using (bucket_id = 'partners-logos');
create policy "Authenticated upload partners logos" on storage.objects
  for insert to authenticated with check (bucket_id = 'partners-logos');
create policy "Authenticated update partners logos" on storage.objects
  for update to authenticated using (bucket_id = 'partners-logos');
create policy "Authenticated delete partners logos" on storage.objects
  for delete to authenticated using (bucket_id = 'partners-logos');

drop policy if exists "Public read offers logos" on storage.objects;
drop policy if exists "Authenticated upload offers logos" on storage.objects;
drop policy if exists "Authenticated update offers logos" on storage.objects;
drop policy if exists "Authenticated delete offers logos" on storage.objects;

create policy "Public read offers logos" on storage.objects
  for select to public using (bucket_id = 'offers-logos');
create policy "Authenticated upload offers logos" on storage.objects
  for insert to authenticated with check (bucket_id = 'offers-logos');
create policy "Authenticated update offers logos" on storage.objects
  for update to authenticated using (bucket_id = 'offers-logos');
create policy "Authenticated delete offers logos" on storage.objects
  for delete to authenticated using (bucket_id = 'offers-logos');

