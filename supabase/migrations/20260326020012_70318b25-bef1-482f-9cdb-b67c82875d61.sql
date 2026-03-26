
-- Add columns to chat_conversations for direct chats
ALTER TABLE chat_conversations 
  ADD COLUMN IF NOT EXISTS participant_id uuid,
  ADD COLUMN IF NOT EXISTS initiated_by uuid,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS deleted_by_initiator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by_participant boolean DEFAULT false;

-- Add status column (default 'active' so existing group convos keep working)
ALTER TABLE chat_conversations 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Validation trigger for status values on direct conversations
CREATE OR REPLACE FUNCTION validate_conversation_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_type = 'direct' AND NEW.status NOT IN ('pending', 'active', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status for direct conversation: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_conversation_status_trigger ON chat_conversations;
CREATE TRIGGER validate_conversation_status_trigger
  BEFORE INSERT OR UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION validate_conversation_status();

-- Partial unique index to prevent duplicate active/pending direct convos
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_direct_conversation 
  ON chat_conversations (event_id, initiated_by, participant_id) 
  WHERE status != 'deleted' AND conversation_type = 'direct';

-- Trigger: update last_message fields on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations 
  SET last_message_at = NOW(),
      last_message_preview = LEFT(NEW.content, 60)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_new_chat_message ON chat_messages;
CREATE TRIGGER on_new_chat_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Add conversation_id to notifications for chat invites
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

-- RLS: attendees see direct convos they participate in
CREATE POLICY "attendee_see_direct_conversations" ON chat_conversations
  FOR SELECT TO authenticated
  USING (
    conversation_type = 'direct' AND (
      initiated_by IN (SELECT get_my_attendee_ids())
      OR participant_id IN (SELECT get_my_attendee_ids())
    )
  );

-- Attendee can start direct conversations
CREATE POLICY "attendee_start_direct_conversation" ON chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_type = 'direct' 
    AND initiated_by IN (SELECT get_my_attendee_ids())
  );

-- Attendee can update direct conversations (accept/reject/delete)
CREATE POLICY "attendee_update_direct_conversation" ON chat_conversations
  FOR UPDATE TO authenticated
  USING (
    conversation_type = 'direct' AND (
      initiated_by IN (SELECT get_my_attendee_ids())
      OR participant_id IN (SELECT get_my_attendee_ids())
    )
  );

-- Messages: attendees see messages in active direct conversations
CREATE POLICY "attendee_see_direct_messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM chat_conversations 
      WHERE conversation_type = 'direct' 
      AND status = 'active'
      AND (
        initiated_by IN (SELECT get_my_attendee_ids())
        OR participant_id IN (SELECT get_my_attendee_ids())
      )
    )
  );

-- Messages: attendees send messages in active direct conversations
CREATE POLICY "attendee_send_direct_messages" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id IN (SELECT get_my_attendee_ids())
    AND conversation_id IN (
      SELECT id FROM chat_conversations 
      WHERE conversation_type = 'direct' 
      AND status = 'active'
      AND (
        initiated_by IN (SELECT get_my_attendee_ids())
        OR participant_id IN (SELECT get_my_attendee_ids())
      )
    )
  );
