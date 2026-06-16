BEGIN;

ALTER TABLE public.chatbot_rag_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Access" ON public.chatbot_rag_documents;
DROP POLICY IF EXISTS "Authenticated Insert" ON public.chatbot_rag_documents;
DROP POLICY IF EXISTS "Authenticated Update" ON public.chatbot_rag_documents;
DROP POLICY IF EXISTS "Authenticated Delete" ON public.chatbot_rag_documents;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.chatbot_rag_documents;
DROP POLICY IF EXISTS "Authenticated users can update" ON public.chatbot_rag_documents;
DROP POLICY IF EXISTS "Authenticated users can delete" ON public.chatbot_rag_documents;

REVOKE ALL ON TABLE public.chatbot_rag_documents FROM anon;
REVOKE ALL ON TABLE public.chatbot_rag_documents FROM authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'match_chatbot_rag'
      AND pg_get_function_identity_arguments(p.oid) = 'vector, double precision, integer'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, double precision, integer) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, double precision, integer) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_chatbot_rag(vector, double precision, integer) TO service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'match_chatbot_rag'
      AND pg_get_function_identity_arguments(p.oid) = 'vector, real, integer'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, real, integer) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, real, integer) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_chatbot_rag(vector, real, integer) TO service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'match_chatbot_rag'
      AND pg_get_function_identity_arguments(p.oid) = 'vector, double precision, integer, jsonb'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, double precision, integer, jsonb) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, double precision, integer, jsonb) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_chatbot_rag(vector, double precision, integer, jsonb) TO service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'match_chatbot_rag'
      AND pg_get_function_identity_arguments(p.oid) = 'vector, real, integer, jsonb'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, real, integer, jsonb) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_chatbot_rag(vector, real, integer, jsonb) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_chatbot_rag(vector, real, integer, jsonb) TO service_role';
  END IF;
END $$;

COMMIT;
