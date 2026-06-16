-- Migration: Support for Chat History Pagination and Async Summary Refresh
-- Date: 2026-01-17

-- 1. Add user_message_count to chat_sessions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_sessions' AND column_name = 'user_message_count') THEN
        ALTER TABLE public.chat_sessions ADD COLUMN user_message_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Add last_user_message_count to chat_session_summaries if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_session_summaries' AND column_name = 'last_user_message_count') THEN
        ALTER TABLE public.chat_session_summaries ADD COLUMN last_user_message_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Function to update message count
CREATE OR REPLACE FUNCTION public.update_chat_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.role = 'user' THEN
            UPDATE public.chat_sessions
            SET user_message_count = user_message_count + 1,
                updated_at = NOW()
            WHERE id = NEW.session_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.role = 'user' THEN
            UPDATE public.chat_sessions
            SET user_message_count = GREATEST(0, user_message_count - 1),
                updated_at = NOW()
            WHERE id = OLD.session_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for chat_messages
DROP TRIGGER IF EXISTS update_message_count_trigger ON public.chat_messages;
CREATE TRIGGER update_message_count_trigger
AFTER INSERT OR DELETE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_session_message_count();

-- 5. Backfill existing counts
UPDATE public.chat_sessions s
SET user_message_count = (
    SELECT COUNT(*)
    FROM public.chat_messages m
    WHERE m.session_id = s.id AND m.role = 'user'
);
