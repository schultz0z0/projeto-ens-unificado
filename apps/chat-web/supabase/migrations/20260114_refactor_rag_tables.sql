-- Migration: Refactor RAG to Domain-Specific Tables (OpenAI 1536d)
-- Date: 2026-01-14

BEGIN;

-- 1. LIMPEZA DE LEGADO ("Lixo")
-- Remove a tabela antiga e todos os seus dados
DROP TABLE IF EXISTS public.chatbot_rag_documents CASCADE;

-- Remove a função antiga (todas as sobrecargas possíveis)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid, pg_get_function_identity_arguments(oid) AS args
        FROM pg_proc
        WHERE proname = 'match_chatbot_rag'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.match_chatbot_rag(' || r.args || ') CASCADE';
    END LOOP;
END $$;

-- Garante que a extensão vector está ativa
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-----------------------------------------------------------------------
-- 2. TABELA: RAG MARKETING
-----------------------------------------------------------------------
CREATE TABLE public.rag_marketing (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(1536) -- OpenAI text-embedding-3-small
);

-- RLS
ALTER TABLE public.rag_marketing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Only" ON public.rag_marketing
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Index
CREATE INDEX rag_marketing_embedding_idx 
    ON public.rag_marketing 
    USING hnsw (embedding vector_cosine_ops);

-- RPC
CREATE OR REPLACE FUNCTION public.match_rag_marketing (
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.1,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM
        public.rag_marketing d
    WHERE
        1 - (d.embedding <=> query_embedding) > match_threshold
        AND d.metadata @> filter
    ORDER BY
        d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-----------------------------------------------------------------------
-- 3. TABELA: RAG ENS (Institucional)
-----------------------------------------------------------------------
CREATE TABLE public.rag_ens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(1536)
);

-- RLS
ALTER TABLE public.rag_ens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Only" ON public.rag_ens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Index
CREATE INDEX rag_ens_embedding_idx 
    ON public.rag_ens 
    USING hnsw (embedding vector_cosine_ops);

-- RPC
CREATE OR REPLACE FUNCTION public.match_rag_ens (
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.1,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM
        public.rag_ens d
    WHERE
        1 - (d.embedding <=> query_embedding) > match_threshold
        AND d.metadata @> filter
    ORDER BY
        d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-----------------------------------------------------------------------
-- 4. TABELA: RAG EMAIL HTML (Templates)
-----------------------------------------------------------------------
CREATE TABLE public.rag_email_html (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(1536)
);

-- RLS
ALTER TABLE public.rag_email_html ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Only" ON public.rag_email_html
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Index
CREATE INDEX rag_email_html_embedding_idx 
    ON public.rag_email_html 
    USING hnsw (embedding vector_cosine_ops);

-- RPC
CREATE OR REPLACE FUNCTION public.match_rag_email_html (
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.1,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM
        public.rag_email_html d
    WHERE
        1 - (d.embedding <=> query_embedding) > match_threshold
        AND d.metadata @> filter
    ORDER BY
        d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMIT;
