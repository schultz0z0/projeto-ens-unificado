-- Resolver erro de ingestão no N8N (source_id NOT NULL)
-- O nó do Supabase no N8N não envia source_id, causando erro de constraint.
-- Tornamos a coluna opcional (NULLABLE) para evitar o erro.

DO $$
BEGIN
    -- Verifica se a coluna source_id existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'source_id') THEN
        -- Remove a restrição NOT NULL
        ALTER TABLE chatbot_rag_documents ALTER COLUMN source_id DROP NOT NULL;
        
        -- Opcional: Se quiser garantir um valor default também, descomente abaixo:
        -- ALTER TABLE chatbot_rag_documents ALTER COLUMN source_id SET DEFAULT 'n8n_auto';
    END IF;

    -- Garantia extra para a coluna corpus (caso a migração anterior tenha falhado ou sido revertida)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatbot_rag_documents' AND column_name = 'corpus') THEN
        ALTER TABLE chatbot_rag_documents ALTER COLUMN corpus SET DEFAULT 'ens';
    END IF;
END $$;
