
-- Drop all RESTRICTIVE SELECT policies for authenticated attendees
DROP POLICY IF EXISTS "Attendees can view own record" ON attendees;
DROP POLICY IF EXISTS "Attendees view event directory" ON attendees;
DROP POLICY IF EXISTS "Authenticated read own attendee record" ON attendees;

-- Recreate as PERMISSIVE (default) so they OR together
CREATE POLICY "Attendees can view own record"
ON attendees FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Attendees view event directory"
ON attendees FOR SELECT TO authenticated
USING (
  event_id IN (SELECT get_my_event_ids())
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);
