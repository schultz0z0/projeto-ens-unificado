-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Cleanup previous generic table (if it exists) to avoid confusion
drop table if exists documents cascade;
drop function if exists match_documents cascade;

-- Create the specific table for Chatbot RAG
create table if not exists chatbot_rag_documents (
  id bigserial primary key,
  content text, -- corresponds to Document.pageContent
  metadata jsonb, -- corresponds to Document.metadata
  embedding vector(768) -- Gemini embeddings dimension (768)
);

-- Create a function to search for documents (renamed to match table)
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

-- Enable RLS
alter table chatbot_rag_documents enable row level security;

-- Policy 1: Allow public read access (required for Chatbot RAG to work with Anon Key)
create policy "Public Read Access"
  on chatbot_rag_documents
  for select
  using (true);

-- Policy 2: Allow authenticated insert/update/delete (for ingestion tools)
create policy "Authenticated users can insert"
  on chatbot_rag_documents
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update"
  on chatbot_rag_documents
  for update
  to authenticated
  using (true);

create policy "Authenticated users can delete"
  on chatbot_rag_documents
  for delete
  to authenticated
  using (true);
