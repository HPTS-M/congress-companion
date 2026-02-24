
-- Create the event group conversation
INSERT INTO public.chat_conversations (id, organization_id, event_id, conversation_type, name, created_by)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'c13fdeea-fcc2-429c-bfc2-2d0900335aee',
  '5efca36a-deef-489b-be85-3dc9d1501ed7',
  'group',
  'Chat General',
  NULL
);

-- Add test user as participant
INSERT INTO public.chat_participants (conversation_id, user_id)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7bcf9b7c-144d-4836-980d-d834a52506d1');

-- Insert 3 test messages from the real auth user
INSERT INTO public.chat_messages (conversation_id, sender_id, content, created_at)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7bcf9b7c-144d-4836-980d-d834a52506d1', 
   '¡Bienvenidos a todos! Muy emocionada de estar en este congreso.', now() - interval '2 hours'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7bcf9b7c-144d-4836-980d-d834a52506d1', 
   'Gracias por la organización. El programa está excelente.', now() - interval '1 hour'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7bcf9b7c-144d-4836-980d-d834a52506d1', 
   '¿Alguien va al taller de IA generativa mañana en Sala 1?', now() - interval '30 minutes');
