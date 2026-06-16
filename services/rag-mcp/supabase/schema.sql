create extension if not exists vector;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null default 'client',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  source_type text not null,
  source_id text,
  source_key text,
  source_uri text,
  visibility text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  embedding_model text,
  fts tsvector generated always as (to_tsvector('portuguese', content)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rag_queries (
  id uuid primary key default gen_random_uuid(),
  actor_profile text not null,
  active_client text,
  allowed_tenants text[] not null,
  query text not null,
  purpose text,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists rag_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile text not null,
  action text not null,
  tenant_id uuid references tenants(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  allowed boolean not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists documents_tenant_id_idx on documents(tenant_id);
create index if not exists documents_tenant_source_idx on documents(tenant_id, source_id);
create unique index if not exists documents_tenant_source_key_idx on documents(tenant_id, source_id, source_key) where source_id is not null and source_key is not null;
create index if not exists document_chunks_tenant_id_idx on document_chunks(tenant_id);
create index if not exists document_chunks_document_id_idx on document_chunks(document_id);
create index if not exists document_chunks_fts_idx on document_chunks using gin(fts);
create index if not exists rag_queries_created_at_idx on rag_queries(created_at desc);
create index if not exists rag_audit_events_created_at_idx on rag_audit_events(created_at desc);

create or replace function match_document_chunks(
  query_text text,
  tenant_slugs text[],
  match_count integer default 8,
  query_embedding vector(1536) default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  tenant_slug text,
  title text,
  content text,
  score real,
  metadata jsonb,
  source_uri text
)
language sql
stable
as $$
  with candidates as (
    select
      c.id as chunk_id,
      d.id as document_id,
      t.slug as tenant_slug,
      d.title,
      c.content,
      c.metadata,
      d.source_uri,
      case
        when c.fts @@ plainto_tsquery('portuguese', query_text)
          then ts_rank_cd(c.fts, plainto_tsquery('portuguese', query_text))
        else 0
      end as fts_score,
      case
        when query_embedding is not null and c.embedding is not null
          then greatest(0, 1 - (c.embedding <=> query_embedding))
        else 0
      end as vector_score
    from document_chunks c
    join documents d on d.id = c.document_id
    join tenants t on t.id = c.tenant_id
    where
      t.slug = any(tenant_slugs)
      and (
        c.fts @@ plainto_tsquery('portuguese', query_text)
        or (query_embedding is not null and c.embedding is not null)
      )
  )
  select
    chunk_id,
    document_id,
    tenant_slug,
    title,
    content,
    ((0.55 * vector_score) + (0.45 * fts_score))::real as score,
    metadata,
    source_uri
  from candidates
  order by score desc
  limit least(match_count, 50);
$$;

insert into tenants (slug, name, type)
values ('nexusai', 'NexusAI', 'internal')
on conflict (slug) do nothing;
