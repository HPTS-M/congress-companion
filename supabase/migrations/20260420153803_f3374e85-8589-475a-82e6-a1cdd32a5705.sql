-- Crear asistente Daniel Sanchez en ACQFH-2026 con código 3ZSTDB6X
INSERT INTO public.attendees (
  event_id,
  full_name,
  email,
  access_code_hash,
  registration_status,
  invitation_sent_at
)
VALUES (
  (SELECT id FROM public.events WHERE event_code = 'ACQFH-2026'),
  'Daniel Sanchez',
  'estudiomapeoloinc@gmail.com',
  '$2b$10$otwWpZ9FZyEP22C55UMIC.r3w7Jj7k1TzhlAehq9HXXYl29oWaoJq',
  'confirmed',
  now()
);

-- Limpiar intentos de acceso para evitar rate-limit 429
DELETE FROM public.access_attempts WHERE event_code = 'ACQFH-2026';