
-- Update RLS INSERT policy to allow sender_id = attendee.id
DROP POLICY IF EXISTS "Participants can send messages" ON public.chat_messages;
CREATE POLICY "Participants can send messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id IN (SELECT id FROM public.attendees WHERE user_id = auth.uid() AND deleted_at IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = auth.uid()
  )
);

-- Update RLS UPDATE policy to use attendee id
DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id IN (SELECT id FROM public.attendees WHERE user_id = auth.uid() AND deleted_at IS NULL));

-- Update RLS DELETE policy to use attendee id
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (sender_id IN (SELECT id FROM public.attendees WHERE user_id = auth.uid() AND deleted_at IS NULL));

-- Fix test messages: assign real attendee IDs as sender_id
-- Message 1 "Bienvenidos" → María González (131b44ac...)
UPDATE public.chat_messages
SET sender_id = '131b44ac-0696-49c2-90ff-99d636629fd0'
WHERE id = 'eb899a19-0886-42b8-8144-ee4585f2c7cd';

-- Message 2 "Gracias" → Carlos Restrepo (a08bd669...)
UPDATE public.chat_messages
SET sender_id = 'a08bd669-126d-4e08-8613-b352d9cb57ba'
WHERE id = 'b97ead8a-01d9-4b46-b69f-a20181d33111';

-- Message 3 "Alguien va al taller" → Ana Martínez (816d2338...)
UPDATE public.chat_messages
SET sender_id = '816d2338-0307-4f11-bd21-47b305455cf3'
WHERE id = '98028233-7968-4926-b3a2-bc2e592cc49b';
