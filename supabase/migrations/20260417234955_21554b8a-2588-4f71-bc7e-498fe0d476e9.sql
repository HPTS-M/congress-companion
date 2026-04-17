DROP VIEW IF EXISTS public.public_attendee_directory;

CREATE VIEW public.public_attendee_directory
WITH (security_invoker = false) AS
SELECT
  a.id,
  a.event_id,
  a.full_name,
  a.specialty,
  a.institution,
  a.registration_status
FROM public.attendees a
WHERE a.deleted_at IS NULL
  AND a.registration_status = 'confirmed'
  AND a.event_id IN (SELECT public.get_my_event_ids());

GRANT SELECT ON public.public_attendee_directory TO authenticated;