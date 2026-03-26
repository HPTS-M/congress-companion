
-- Fix search_path for validate_conversation_status
CREATE OR REPLACE FUNCTION validate_conversation_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_type = 'direct' AND NEW.status NOT IN ('pending', 'active', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status for direct conversation: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix search_path for update_conversation_last_message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations 
  SET last_message_at = NOW(),
      last_message_preview = LEFT(NEW.content, 60)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
