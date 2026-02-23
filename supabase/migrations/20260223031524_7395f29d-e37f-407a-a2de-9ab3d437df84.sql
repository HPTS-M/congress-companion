
-- Fix ERROR 1: Replace self-referential RLS policy with get_my_event_ids()
DROP POLICY IF EXISTS "Attendees view event directory" ON attendees;

CREATE POLICY "Attendees view event directory"
ON attendees FOR SELECT TO authenticated
USING (
  event_id IN (SELECT get_my_event_ids())
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);

-- Fix ERROR 2: Rehash TEST1234 for test attendee
UPDATE attendees
SET access_code_hash = extensions.crypt('TEST1234', extensions.gen_salt('bf', 10))
WHERE id = 'fb9cb992-242e-41d2-98f8-cc28bf70edce';

-- Fix ERROR 3: Clear rate limit table
DELETE FROM access_attempts;
