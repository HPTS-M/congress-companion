

## Plan: Direct Messaging System for Attendees

### Schema Adaptations

The user's SQL has several issues that need correction for the existing schema:

1. **No `participant_id` column exists** on `chat_conversations` — must be added
2. **No `auth_user_id`** column on `attendees` — the column is `user_id`
3. **CHECK constraints violate project guidelines** — must use validation trigger
4. **Partial unique indexes** use different syntax in Postgres
5. **RLS policies already exist** on both tables — must drop conflicting ones before adding new ones
6. **`chat_participants` table** is used for group chats and must remain untouched

### Step 1: Database Migration

Single migration adding columns and trigger:

```sql
-- Add columns to chat_conversations for direct chats
ALTER TABLE chat_conversations 
  ADD COLUMN IF NOT EXISTS participant_id uuid,
  ADD COLUMN IF NOT EXISTS initiated_by uuid,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS deleted_by_initiator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by_participant boolean DEFAULT false;

-- Add status column with validation trigger (not CHECK constraint)
ALTER TABLE chat_conversations 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Validation trigger for status values
CREATE OR REPLACE FUNCTION validate_conversation_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_type = 'direct' AND NEW.status NOT IN ('pending', 'active', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status for direct conversation: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_conversation_status_trigger
  BEFORE INSERT OR UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION validate_conversation_status();

-- Partial unique index (not constraint) for no duplicate active/pending convos
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

-- Add conversation_id to notifications
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

-- Messages in active direct conversations
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
```

### Step 2: Messaging Service — Add Direct Chat Methods

Add to `src/services/messaging.service.ts`:

- `getDirectConversations(eventId, attendeeId)` — fetch direct convos where user is initiator or participant, join attendee names
- `createDirectConversation(eventId, initiatorId, participantId, orgId)` — insert with status `pending`
- `acceptConversation(conversationId)` — update status to `active`
- `rejectConversation(conversationId)` — update status to `deleted`
- `deleteConversation(conversationId, attendeeId, isInitiator)` — set `deleted_by_*` flag, set status `deleted` if both
- `getDirectMessages(conversationId)` — same as group but filtered

### Step 3: Messaging Hook — Add Direct Chat Hooks

Add to `src/hooks/useMessaging.ts`:

- `useDirectConversations(eventId, attendeeId)` — query for conversation list
- `useAcceptConversation()` — mutation
- `useRejectConversation()` — mutation
- `useCreateDirectConversation()` — mutation
- `useDeleteConversation()` — mutation
- `useDirectMessages(conversationId)` — query

### Step 4: Rebuild "Mensajes" Tab in Messaging.tsx

Replace the placeholder `TabsContent value="direct"` with:

**View A — Conversation List** (when no conversation selected):
- Search bar + "New conversation" button
- "Pending invites" section (convos where `participant_id = me` and `status = 'pending'`) with Accept/Reject buttons
- "My conversations" section (active convos) showing name, time, preview
- Tapping a conversation sets `selectedConversation` state

**View B — Chat View** (when conversation selected):
- Back arrow + contact name header
- Message list (reuse existing bubble rendering from group chat)
- Input bar (disabled if status is `pending`)
- Delete conversation button

**New Conversation Modal**:
- Dialog with searchable attendee list (reuse `useEventAttendees` from contacts)
- Exclude self and existing active/pending conversations
- On select: create conversation + show toast

### Step 5: Realtime Subscriptions

In the direct tab, subscribe to:
- `postgres_changes` INSERT on `chat_messages` filtered by active conversation IDs
- `postgres_changes` UPDATE on `chat_conversations` for status changes (accept/reject)

### Step 6: i18n Keys

Add to both `es/messaging.json` and `en/messaging.json`:

```text
newConversation, searchAttendees, pendingInvites, myConversations,
inviteSent, acceptInvite, rejectInvite, pendingBadge, 
deleteConversation, confirmDelete, conversationDeleted, 
noConversations, wantsToChat, back, noMessages
```

### Files Changed

1. **Migration** — new columns, triggers, RLS policies
2. `src/services/messaging.service.ts` — add 6 direct chat methods
3. `src/hooks/useMessaging.ts` — add 6 hooks
4. `src/pages/attendee/Messaging.tsx` — rebuild direct tab (conversation list + chat view + new conversation dialog)
5. `src/locales/es/messaging.json` — add ~15 keys
6. `src/locales/en/messaging.json` — add ~15 keys

### What stays untouched
- Group chat tab (Chat General) — zero changes
- `chat_participants` table — unchanged
- Existing RLS policies for group chat — unchanged
- Admin communications module — unchanged

