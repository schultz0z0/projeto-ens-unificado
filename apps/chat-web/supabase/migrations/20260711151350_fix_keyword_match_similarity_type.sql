create or replace function public.kw_match_rag_ens(
  query_text text,
  match_threshold double precision,
  match_count integer,
  filter jsonb default '{}'::jsonb
)
returns table(
  id bigint,
  content text,
  metadata jsonb,
  similarity double precision
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  select
    source.id,
    source.content,
    source.metadata,
    ts_rank_cd(
      to_tsvector('portuguese', source.content),
      websearch_to_tsquery('portuguese', query_text)
    )::double precision as similarity
  from public.rag_ens as source
  where to_tsvector('portuguese', source.content)
    @@ websearch_to_tsquery('portuguese', query_text)
    and source.metadata @> filter
  order by similarity desc
  limit match_count;
end;
$$;

create or replace function public.kw_match_rag_marketing(
  query_text text,
  match_threshold double precision,
  match_count integer,
  filter jsonb default '{}'::jsonb
)
returns table(
  id bigint,
  content text,
  metadata jsonb,
  similarity double precision
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  select
    source.id,
    source.content,
    source.metadata,
    ts_rank_cd(
      to_tsvector('portuguese', source.content),
      websearch_to_tsquery('portuguese', query_text)
    )::double precision as similarity
  from public.rag_marketing as source
  where to_tsvector('portuguese', source.content)
    @@ websearch_to_tsquery('portuguese', query_text)
    and source.metadata @> filter
  order by similarity desc
  limit match_count;
end;
$$;
