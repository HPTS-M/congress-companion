

## Fix: Attendees can't use group chat or start direct conversations

### Root Cause

**Group Chat**: The `chat_participants` table only has 1 user. The RLS INSERT policy on `chat_messages` requires the sender to exist in `chat_participants` for that conversation. New attendees are never added automatically.

**Duplicate attendee**: Daniel Sanchez has two records in `attendees` — one pending (no user_id) and one confirmed. The pending one should be cleaned up.

### Solution: 2 changes

#### 1. Database migration — Auto-add confirmed attendees to group chat

Create a trigger that automatically inserts into `chat_participants` when an attendee's `user_id` is set (i.e., when they log in and get confirmed). Also run a one-time backfill for existing confirmed attendees.

```sql
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
```

This ensures every attendee who logs in automatically gets access to the group chat.

#### 2. Clean up duplicate Daniel Sanchez

Delete the orphan pending record (no user_id, id `ecd1b91a...`) to prevent future conflicts with direct messaging unique constraints.

```sql
UPDATE attendees SET deleted_at = NOW() 
WHERE id = 'ecd1b91a-3fac-4021-b492-1d9d4d9dfe68';
```

### Files Changed
1. New migration (trigger + backfill + cleanup)

### Result
- All existing confirmed attendees immediately get group chat access
- Future attendees automatically join group chat when they log in
- Daniel Sanchez can send messages in Chat General and start direct conversations
- No frontend code changes needed

