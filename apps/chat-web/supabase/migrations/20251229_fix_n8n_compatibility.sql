-- Fix N8N Compatibility (RAG & Chatbot)
-- 1. Resolve erro de ingestão: Define valor padrão para coluna 'corpus'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'corpus') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN corpus SET DEFAULT 'ens';
    ELSE
        ALTER TABLE chatbot_rag_documents ADD COLUMN corpus text DEFAULT 'ens';
    END IF;
END $$;

-- 2. Resolve erro de busca (PGRST202): Ajusta assinatura da função match_chatbot_rag para aceitar filtro do N8N
-- DROP FUNCTION para evitar erro "cannot remove parameter defaults" se a assinatura mudar drasticamente
DROP FUNCTION IF EXISTS match_chatbot_rag(vector, float, int, jsonb);

CREATE OR REPLACE FUNCTION match_chatbot_rag (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.1, -- Default adicionado para N8N que não envia este parametro
  match_count int DEFAULT 10,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
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
    FROM chatbot_rag_documents d
    WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    AND d.metadata @> filter
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
