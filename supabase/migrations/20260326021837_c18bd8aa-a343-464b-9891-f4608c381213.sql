-- Trigger: when attendee gets a user_id, add them to group chat
CREATE OR REPLACE FUNCTION auto_join_group_chat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id) THEN
    INSERT INTO chat_participants (conversation_id, user_id)
    SELECT cc.id, NEW.user_id
    FROM chat_conversations cc
    WHERE cc.event_id = NEW.event_id
      AND cc.conversation_type = 'group'
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_attendee_user_linked
  AFTER UPDATE ON attendees
  FOR EACH ROW EXECUTE FUNCTION auto_join_group_chat();

-- Backfill: add all existing confirmed attendees with user_id
INSERT INTO chat_participants (conversation_id, user_id)
SELECT cc.id, a.user_id
FROM attendees a
JOIN chat_conversations cc ON cc.event_id = a.event_id AND cc.conversation_type = 'group'
WHERE a.user_id IS NOT NULL AND a.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Clean up duplicate Daniel Sanchez (orphan pending record)
UPDATE attendees SET deleted_at = NOW() 
WHERE id = 'ecd1b91a-3fac-4021-b492-1d9d4d9dfe68';