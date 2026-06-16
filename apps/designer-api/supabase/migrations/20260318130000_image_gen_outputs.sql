create schema if not exists image_gen;

create extension if not exists pgcrypto;

create table if not exists image_gen.outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  item_id uuid not null unique,
  requested_by uuid null,
  canal text not null,
  kv text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  mime_type text not null default 'image/png',
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_image_gen_outputs_job_id on image_gen.outputs (job_id);
create index if not exists idx_image_gen_outputs_requested_by on image_gen.outputs (requested_by);
create index if not exists idx_image_gen_outputs_created_at on image_gen.outputs (created_at desc);

alter table image_gen.outputs enable row level security;
alter table image_gen.outputs force row level security;

drop policy if exists outputs_select_own on image_gen.outputs;
create policy outputs_select_own
on image_gen.outputs
for select
to authenticated
using (requested_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('image-gen-outputs', 'image-gen-outputs', false, 10485760, array['image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
