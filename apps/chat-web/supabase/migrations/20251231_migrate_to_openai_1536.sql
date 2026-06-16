-- Enable vector extension ensuring it is available
create extension if not exists vector with schema public;

-- 1. CLEANUP: Drop existing function and table (Order matters due to dependencies)
-- Dropping the function first prevents dependency errors when dropping the table
drop function if exists match_chatbot_rag(vector, float, int, jsonb);
drop function if exists match_chatbot_rag; 
drop table if exists chatbot_rag_documents;

-- 2. CREATE TABLE
-- Using vector(1536) compatible with OpenAI text-embedding-3-small
create table chatbot_rag_documents (
  id bigint primary key generated always as identity,
  content text,
  metadata jsonb default '{}'::jsonb,
  embedding vector(1536)
);

-- 3. SECURITY (RLS)
alter table chatbot_rag_documents enable row level security;

-- Policy: Public Read (Allows the chatbot to search documents)
create policy "Allow public read access"
  on chatbot_rag_documents
  for select
  to public
  using (true);

-- Policy: Authenticated Write (Allows admin/backend to ingest documents)
create policy "Allow authenticated insert"
  on chatbot_rag_documents
  for insert
  to authenticated
  with check (true);

create policy "Allow authenticated update"
  on chatbot_rag_documents
  for update
  to authenticated
  using (true);

create policy "Allow authenticated delete"
  on chatbot_rag_documents
  for delete
  to authenticated
  using (true);

-- 4. INDEXES (Performance)
-- HNSW Index for approximate nearest neighbor search (Performance critical for high dimensionality)
create index chatbot_rag_documents_embedding_idx 
  on chatbot_rag_documents 
  using hnsw (embedding vector_cosine_ops);

-- GIN Index for metadata filtering (Critical for filtering by source/tags before vector search)
create index chatbot_rag_documents_metadata_idx 
  on chatbot_rag_documents 
  using gin (metadata);

-- 5. RPC FUNCTION
-- Optimized for vector(1536) and JSONB filtering
create or replace function match_chatbot_rag (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb DEFAULT '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chatbot_rag_documents.id,
    chatbot_rag_documents.content,
    chatbot_rag_documents.metadata,
    1 - (chatbot_rag_documents.embedding <=> query_embedding) as similarity
  from chatbot_rag_documents
  where 1 - (chatbot_rag_documents.embedding <=> query_embedding) > match_threshold
  and chatbot_rag_documents.metadata @> filter
  order by chatbot_rag_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
