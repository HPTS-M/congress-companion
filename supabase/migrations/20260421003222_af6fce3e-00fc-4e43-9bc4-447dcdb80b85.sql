-- 1. Add delivered_at column
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL;

-- 2. Partial index for fast lookup of undelivered messages per conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_undelivered
ON public.chat_messages(conversation_id)
WHERE delivered_at IS NULL;

-- 3. RPC: mark all messages in a conversation as delivered for the receiver
CREATE OR REPLACE FUNCTION public.mark_messages_delivered(
  _conversation_id uuid,
  _attendee_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _updated integer;
BEGIN
  -- Validate caller actually owns this attendee profile
  IF _attendee_id NOT IN (SELECT public.get_my_attendee_ids()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate the attendee is part of the conversation
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = _conversation_id
      AND conversation_type = 'direct'
      AND (initiated_by = _attendee_id OR participant_id = _attendee_id)
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  -- Mark as delivered: only messages sent by the OTHER party, still undelivered
  WITH upd AS (
    UPDATE public.chat_messages
    SET delivered_at = now()
    WHERE conversation_id = _conversation_id
      AND sender_id <> _attendee_id
      AND delivered_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO _updated FROM upd;

  RETURN _updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_delivered(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_messages_delivered(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(uuid, uuid) TO authenticated;

-- 4. Ensure UPDATE events on chat_messages are broadcast via Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
END $$;