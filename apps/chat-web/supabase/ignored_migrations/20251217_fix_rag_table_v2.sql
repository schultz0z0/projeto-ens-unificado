-- Fix RAG table name and dimensions
-- This migration drops the old 'documents' table and creates 'chatbot_rag_documents' with vector(768)

-- 1. Drop old resources if they exist
drop table if exists documents cascade;
drop function if exists match_documents cascade;
drop table if exists chatbot_rag_documents cascade; -- safety check
drop function if exists match_chatbot_rag cascade; -- safety check

-- 2. Create the specific table for Chatbot RAG
create table chatbot_rag_documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(768) -- Correct dimension for Gemini
);

-- 3. Create search function
create or replace function match_chatbot_rag (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query(
    select
      chatbot_rag_documents.id,
      chatbot_rag_documents.content,
      chatbot_rag_documents.metadata,
      1 - (chatbot_rag_documents.embedding <=> query_embedding) as similarity
    from chatbot_rag_documents
    where 1 - (chatbot_rag_documents.embedding <=> query_embedding) > match_threshold
    order by chatbot_rag_documents.embedding <=> query_embedding
    limit match_count
  );
end;
$$;

-- 4. Security (RLS)
alter table chatbot_rag_documents enable row level security;

create policy "Public Read Access"
  on chatbot_rag_documents
  for select
  using (true);

create policy "Authenticated Insert"
  on chatbot_rag_documents
  for insert
  to authenticated
  with check (true);

create policy "Authenticated Update"
  on chatbot_rag_documents
  for update
  to authenticated
  using (true);

create policy "Authenticated Delete"
  on chatbot_rag_documents
  for delete
  to authenticated
  using (true);
