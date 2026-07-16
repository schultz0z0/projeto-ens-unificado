-- Optimize match_document_chunks_advanced using UNION ALL to ensure index scans instead of a slow sequential scan.
create or replace function match_document_chunks_advanced(
  query_text text,
  tenant_slugs text[],
  match_count integer default 8,
  query_embedding vector(1536) default null,
  collections text[] default null,
  freshness_cutoff timestamptz default null,
  include_stale boolean default true,
  chunk_kinds text[] default null,
  course_categories text[] default null,
  course_types text[] default null,
  course_statuses text[] default null,
  offer_statuses text[] default null,
  modalities text[] default null,
  localities text[] default null,
  only_active_offers boolean default false,
  offer_start_from timestamptz default null,
  offer_start_to timestamptz default null,
  enrollment_open_at timestamptz default null
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
  source_uri text,
  rank_reason text,
  score_breakdown jsonb
)
language sql
stable
as $$
  with candidates as (
    -- Branch 1: Full-Text Search (FTS) - Uses GIN index
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
      coalesce(c.metadata->>'split_from_kind', regexp_replace(coalesce(c.metadata->>'chunk_kind', ''), '_part_[0-9]+$', '')) as base_chunk_kind,
      coalesce(c.metadata->>'course_category', d.metadata->>'course_category', d.metadata->>'categoria') as course_category,
      coalesce(c.metadata->>'course_type', d.metadata->>'course_type', d.metadata->>'tipo') as course_type,
      coalesce(c.metadata->>'course_status', d.metadata->>'course_status', d.metadata->>'liberar_curso') as course_status,
      c.metadata->>'offer_status' as offer_status,
      c.metadata->>'offer_modality' as offer_modality,
      c.metadata->>'offer_location' as offer_location,
      coalesce((c.metadata->>'offer_hidden')::boolean, false) as offer_hidden,
      ts_rank_cd(c.fts, plainto_tsquery('portuguese', query_text)) as fts_score,
      0::real as vector_score
    from document_chunks c
    join documents d on d.id = c.document_id
    join tenants t on t.id = c.tenant_id
    where
      t.slug = any(tenant_slugs)
      and (collections is null or d.collection = any(collections))
      and c.fts @@ plainto_tsquery('portuguese', query_text)

    union all

    -- Branch 2: Title exact/partial match - Uses documents title filters
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
      coalesce(c.metadata->>'split_from_kind', regexp_replace(coalesce(c.metadata->>'chunk_kind', ''), '_part_[0-9]+$', '')) as base_chunk_kind,
      coalesce(c.metadata->>'course_category', d.metadata->>'course_category', d.metadata->>'categoria') as course_category,
      coalesce(c.metadata->>'course_type', d.metadata->>'course_type', d.metadata->>'tipo') as course_type,
      coalesce(c.metadata->>'course_status', d.metadata->>'course_status', d.metadata->>'liberar_curso') as course_status,
      c.metadata->>'offer_status' as offer_status,
      c.metadata->>'offer_modality' as offer_modality,
      c.metadata->>'offer_location' as offer_location,
      coalesce((c.metadata->>'offer_hidden')::boolean, false) as offer_hidden,
      0::real as fts_score,
      0::real as vector_score
    from document_chunks c
    join documents d on d.id = c.document_id
    join tenants t on t.id = c.tenant_id
    where
      t.slug = any(tenant_slugs)
      and (collections is null or d.collection = any(collections))
      and lower(d.title) like '%' || lower(query_text) || '%'
      and not (c.fts @@ plainto_tsquery('portuguese', query_text)) -- Avoid duplicates with Branch 1

    union all

    -- Branch 3: Vector similarity search (only if query_embedding is provided)
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
      coalesce(c.metadata->>'split_from_kind', regexp_replace(coalesce(c.metadata->>'chunk_kind', ''), '_part_[0-9]+$', '')) as base_chunk_kind,
      coalesce(c.metadata->>'course_category', d.metadata->>'course_category', d.metadata->>'categoria') as course_category,
      coalesce(c.metadata->>'course_type', d.metadata->>'course_type', d.metadata->>'tipo') as course_type,
      coalesce(c.metadata->>'course_status', d.metadata->>'course_status', d.metadata->>'liberar_curso') as course_status,
      c.metadata->>'offer_status' as offer_status,
      c.metadata->>'offer_modality' as offer_modality,
      c.metadata->>'offer_location' as offer_location,
      coalesce((c.metadata->>'offer_hidden')::boolean, false) as offer_hidden,
      0::real as fts_score,
      greatest(0, 1 - (c.embedding <=> query_embedding))::real as vector_score
    from document_chunks c
    join documents d on d.id = c.document_id
    join tenants t on t.id = c.tenant_id
    where
      query_embedding is not null
      and t.slug = any(tenant_slugs)
      and (collections is null or d.collection = any(collections))
      and c.embedding is not null
      and not (c.fts @@ plainto_tsquery('portuguese', query_text))
      and not (lower(d.title) like '%' || lower(query_text) || '%')
  ),
  filtered as (
    select * from candidates
    where
      (
        include_stale
        or freshness_cutoff is null
        or coalesce(
          case
            when (metadata->>'analysis_date') ~ '^\d{4}-\d{2}-\d{2}'
              then (metadata->>'analysis_date')::timestamptz
            else null
          end,
          updated_at
        ) >= freshness_cutoff
      )
      and (
        chunk_kinds is null
        or base_chunk_kind = any(chunk_kinds)
      )
      and (
        course_categories is null
        or exists (
          select 1 from unnest(course_categories) item
          where lower(coalesce(course_category, '')) = lower(item)
        )
      )
      and (
        course_types is null
        or exists (
          select 1 from unnest(course_types) item
          where lower(coalesce(course_type, '')) = lower(item)
        )
      )
      and (
        course_statuses is null
        or exists (
          select 1 from unnest(course_statuses) item
          where lower(coalesce(course_status, '')) = lower(item)
        )
      )
      and (
        offer_statuses is null
        or exists (
          select 1 from unnest(offer_statuses) item
          where lower(coalesce(offer_status, '')) = lower(item)
        )
      )
      and (
        modalities is null
        or exists (
          select 1 from unnest(modalities) item
          where lower(coalesce(offer_modality, '')) like '%' || lower(item) || '%'
        )
      )
      and (
        localities is null
        or exists (
          select 1 from unnest(localities) item
          where lower(coalesce(offer_location, '')) like '%' || lower(item) || '%'
        )
      )
      and (
        offer_start_from is null
        or (
          metadata ? 'offer_start_date'
          and metadata->>'offer_start_date' <> ''
          and (metadata->>'offer_start_date')::timestamptz >= offer_start_from
        )
      )
      and (
        offer_start_to is null
        or (
          metadata ? 'offer_start_date'
          and metadata->>'offer_start_date' <> ''
          and (metadata->>'offer_start_date')::timestamptz <= offer_start_to
        )
      )
      and (
        enrollment_open_at is null
        or (
          (not (metadata ? 'enrollment_start_date') or metadata->>'enrollment_start_date' = '' or (metadata->>'enrollment_start_date')::timestamptz <= enrollment_open_at)
          and (not (metadata ? 'enrollment_end_date') or metadata->>'enrollment_end_date' = '' or (metadata->>'enrollment_end_date')::timestamptz >= enrollment_open_at)
        )
      )
      and (
        not only_active_offers
        or base_chunk_kind is distinct from 'course_offer'
        or (
          offer_status = 'available'
          and offer_hidden = false
          and (
            not (metadata ? 'enrollment_end_date')
            or metadata->>'enrollment_end_date' = ''
            or (metadata->>'enrollment_end_date')::timestamptz >= now()
          )
        )
      )
  ),
  scored as (
    select
      *,
      case
        when lower(title) = lower(query_text) then 0.25
        when lower(title) like '%' || lower(query_text) || '%' then 0.18
        when lower(query_text) like '%' || lower(title) || '%' then 0.14
        else 0
      end as title_boost,
      case
        when base_chunk_kind = 'course_offer' and query_text ~* '(oferta|inscri|link|data|investimento|valor|pre[cç]o|modalidade|turma|aula|matr[ií]cula)' then 0.18
        when base_chunk_kind = 'course_summary' and query_text ~* '(curso|carga|dura[cç][aã]o|tipo|categoria)' then 0.08
        else 0
      end as chunk_boost,
      case
        when base_chunk_kind = 'course_offer' and offer_status = 'available' and offer_hidden = false then 0.14
        else 0
      end as active_offer_boost,
      case
        when base_chunk_kind = 'course_offer' and offer_status = 'blocked' then -0.08
        else 0
      end as blocked_offer_penalty
    from filtered
  )
  select
    chunk_id,
    document_id,
    tenant_slug,
    collection,
    title,
    content,
    (
      (0.48 * vector_score)
      + (0.32 * fts_score)
      + title_boost
      + chunk_boost
      + active_offer_boost
      + blocked_offer_penalty
    )::real as score,
    metadata,
    source_uri,
    array_to_string(
      array_remove(array[
        case when title_boost > 0 then 'title_match' else null end,
        case when chunk_boost > 0 then 'chunk_kind_boost' else null end,
        case when active_offer_boost > 0 then 'active_offer' else null end,
        case when blocked_offer_penalty < 0 then 'blocked_offer_penalty' else null end
      ], null),
      ','
    ) as rank_reason,
    jsonb_build_object(
      'vector', vector_score,
      'fts', fts_score,
      'title_boost', title_boost,
      'chunk_boost', chunk_boost,
      'active_offer_boost', active_offer_boost,
      'blocked_offer_penalty', blocked_offer_penalty
    ) as score_breakdown
  from scored
  order by score desc, updated_at desc
  limit least(match_count, 50);
$$;
