-- Apply manually in the Supabase SQL editor for the ENS RAG project.

alter table documents
  add column if not exists collection text not null default 'courses';

alter table document_chunks
  add column if not exists collection text not null default 'courses';

update documents
set collection = case
  when source_id = 'ens_courses' then 'courses'
  when metadata->>'collection' in ('courses', 'insights', 'institutional', 'marketing')
    then metadata->>'collection'
  when tenant_id in (select id from tenants where slug = 'ens') then 'institutional'
  else 'institutional'
end;

update document_chunks c
set collection = d.collection
from documents d
where c.document_id = d.id;

alter table documents
  drop constraint if exists documents_collection_check;

alter table documents
  add constraint documents_collection_check
  check (collection in ('courses', 'insights', 'institutional', 'marketing'));

alter table document_chunks
  drop constraint if exists document_chunks_collection_check;

alter table document_chunks
  add constraint document_chunks_collection_check
  check (collection in ('courses', 'insights', 'institutional', 'marketing'));

create index if not exists documents_collection_source_idx on documents(collection, source_id);
create index if not exists documents_collection_updated_at_idx on documents(collection, updated_at desc);
create index if not exists document_chunks_collection_idx on document_chunks(collection);

drop function if exists match_document_chunks(text, text[], integer, vector);

create or replace function match_document_chunks(
  query_text text,
  tenant_slugs text[],
  match_count integer default 8,
  query_embedding vector(1536) default null,
  collections text[] default null,
  freshness_cutoff timestamptz default null,
  include_stale boolean default true
)
returns table (
  chunk_id uuid,
  document_id uuid,
  tenant_slug text,
  collection text,
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
      d.collection,
      d.title,
      c.content,
      c.metadata,
      d.source_uri,
      d.updated_at,
      case
        when (d.metadata->>'analysis_date') ~ '^\d{4}-\d{2}-\d{2}'
          then (d.metadata->>'analysis_date')::timestamptz
        else null
      end as analysis_date,
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
      and (collections is null or d.collection = any(collections))
      and (
        include_stale
        or freshness_cutoff is null
        or coalesce(
          case
            when (d.metadata->>'analysis_date') ~ '^\d{4}-\d{2}-\d{2}'
              then (d.metadata->>'analysis_date')::timestamptz
            else null
          end,
          d.updated_at
        ) >= freshness_cutoff
      )
      and (
        c.fts @@ plainto_tsquery('portuguese', query_text)
        or (query_embedding is not null and c.embedding is not null)
      )
  )
  select
    chunk_id,
    document_id,
    tenant_slug,
    collection,
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
values ('ens', 'ENS', 'client')
on conflict (slug) do nothing;
