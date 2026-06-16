alter table documents add column if not exists source_id text;
alter table documents add column if not exists source_key text;
alter table document_chunks add column if not exists embedding_model text;

create index if not exists documents_tenant_source_idx on documents(tenant_id, source_id);
create unique index if not exists documents_tenant_source_key_idx on documents(tenant_id, source_id, source_key)
where source_id is not null and source_key is not null;

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
values ('ens', 'ENS', 'client')
on conflict (slug) do nothing;
