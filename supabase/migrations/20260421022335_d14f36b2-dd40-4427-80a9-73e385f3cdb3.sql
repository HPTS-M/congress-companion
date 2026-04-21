-- Add reply_to_id column to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Index for fast lookups when joining replies
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id
  ON public.chat_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- Trigger function: ensure reply_to_id points to a message in the SAME conversation
CREATE OR REPLACE FUNCTION public.validate_reply_same_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.chat_messages
      WHERE id = NEW.reply_to_id
        AND conversation_id = NEW.conversation_id
    ) THEN
      RAISE EXCEPTION 'reply_to_id must reference a message in the same conversation'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_validate_reply_same_conversation ON public.chat_messages;
CREATE TRIGGER trg_validate_reply_same_conversation
  BEFORE INSERT OR UPDATE OF reply_to_id ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reply_same_conversation();