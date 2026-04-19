-- Restrict attendee read access to active poll options only
DROP POLICY IF EXISTS "Attendees read active poll options" ON public.poll_options;

CREATE POLICY "Attendees read active poll options"
ON public.poll_options
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_options.poll_id
      AND p.status = 'active'
      AND p.event_id IN (SELECT public.get_my_event_ids())
  )
);