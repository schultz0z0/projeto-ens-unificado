-- Resolver erro de constraint 'chunk_index' no N8N
-- O nó do Supabase no N8N não envia metadados explícitos para colunas, apenas JSONB.
-- Precisamos garantir que todas as colunas auxiliares sejam NULLABLE.

DO $$
BEGIN
    -- 1. chunk_index (Erro atual)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'chunk_index') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN chunk_index DROP NOT NULL;
    END IF;

    -- 2. file_id (Prevenção)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'file_id') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN file_id DROP NOT NULL;
    END IF;

    -- 3. user_id (Prevenção)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'user_id') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN user_id DROP NOT NULL;
    END IF;

    -- 4. page_number (Prevenção)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'page_number') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN page_number DROP NOT NULL;
    END IF;
END $$;
