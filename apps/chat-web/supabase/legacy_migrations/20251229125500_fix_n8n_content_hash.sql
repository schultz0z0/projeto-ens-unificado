-- Resolver erro de constraint 'content_hash' no N8N e outras possíveis restrições
-- O nó do Supabase no N8N não envia 'content_hash' automaticamente.
-- Tornamos essa coluna e outras potenciais colunas problemáticas opcionais (NULLABLE).

DO $$
BEGIN
    -- 1. content_hash (Erro atual)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'content_hash') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN content_hash DROP NOT NULL;
    END IF;

    -- 2. Garantir que outras colunas comuns também não bloqueiem
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'source_id') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN source_id DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'chunk_index') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN chunk_index DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'file_id') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN file_id DROP NOT NULL;
    END IF;
    
    -- 3. Garantir defaults onde possível
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'corpus') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN corpus SET DEFAULT 'ens';
    END IF;

END $$;
