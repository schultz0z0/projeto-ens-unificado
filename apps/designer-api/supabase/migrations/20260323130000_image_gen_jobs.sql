create table if not exists image_gen.jobs (
    id uuid primary key,
    modo_geracao text not null check (modo_geracao in ('peca_unica', 'enxoval')),
    status text not null check (status in ('pending', 'running', 'done', 'partial_done', 'failed')),
    briefing jsonb not null default '{}'::jsonb,
    kv text not null,
    requested_by uuid null,
    source_system text not null default 'nexus-designer-api',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    progress text null,
    file_url text null,
    error text null
);

create table if not exists image_gen.job_items (
    id uuid primary key,
    job_id uuid not null references image_gen.jobs(id) on delete cascade,
    canal text not null,
    kv text not null,
    status text not null check (status in ('pending', 'running', 'done', 'failed')),
    file_url text null,
    storage_path text null,
    signed_url_expires_at timestamptz null,
    error text null,
    local_output_path text null,
    started_at timestamptz null,
    completed_at timestamptz null,
    elapsed_seconds numeric(10,3) null
);

create table if not exists image_gen.job_metrics (
    job_id uuid primary key references image_gen.jobs(id) on delete cascade,
    elapsed_seconds_total numeric(10,3) not null default 0,
    elapsed_seconds_by_channel jsonb not null default '{}'::jsonb,
    estimated_seconds_remaining numeric(10,3) not null default 0,
    estimated_completion_at timestamptz null,
    sampled_at timestamptz not null default now(),
    started_at timestamptz null,
    updated_at timestamptz null
);

create index if not exists idx_jobs_status on image_gen.jobs(status, created_at desc);
create index if not exists idx_jobs_requested_by on image_gen.jobs(requested_by, created_at desc);
create index if not exists idx_job_items_job_id on image_gen.job_items(job_id, canal);
create index if not exists idx_job_items_status on image_gen.job_items(status, started_at);

-- RLS
alter table image_gen.jobs enable row level security;
alter table image_gen.job_items enable row level security;
alter table image_gen.job_metrics enable row level security;

-- Policies for Jobs
create policy jobs_select_own on image_gen.jobs
for select to authenticated using (requested_by = auth.uid());

-- Policies for Job Items
create policy job_items_select_own on image_gen.job_items
for select to authenticated using (
    job_id in (select id from image_gen.jobs where requested_by = auth.uid())
);

-- Policies for Job Metrics
create policy job_metrics_select_own on image_gen.job_metrics
for select to authenticated using (
    job_id in (select id from image_gen.jobs where requested_by = auth.uid())
);
