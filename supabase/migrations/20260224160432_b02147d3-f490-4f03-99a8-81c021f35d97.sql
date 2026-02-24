
-- Drop FK constraint on chat_messages.sender_id to allow flexible sender references
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

-- Fix messaging bug: update 2 test messages to have different sender_ids
UPDATE public.chat_messages
SET sender_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01'
WHERE conversation_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND content LIKE '%Gracias por la organización%';

UPDATE public.chat_messages
SET sender_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02'
WHERE conversation_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND content LIKE '%Alguien va al taller%';

-- Insert 3 test announcements
INSERT INTO public.announcements (event_id, title, body, reach, sent_at)
VALUES
  ('5efca36a-deef-489b-be85-3dc9d1501ed7',
   'Bienvenidos al XIII Congreso',
   'Les damos la bienvenida a todos los asistentes. El registro está abierto en el lobby principal hasta las 12:00 pm.',
   'all', now() - interval '3 hours'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7',
   'Cambio de sala - Taller IA',
   'El taller de Inteligencia Artificial Generativa se traslada a Sala 2 por mayor capacidad. Disculpen los inconvenientes.',
   'all', now() - interval '1 hour'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7',
   'Cena de Gala - Recordatorio',
   'Les recordamos que la Cena de Gala es esta noche a las 7:00 pm en el salón Medellín. Código de vestimenta: formal.',
   'all', now() - interval '15 minutes');
