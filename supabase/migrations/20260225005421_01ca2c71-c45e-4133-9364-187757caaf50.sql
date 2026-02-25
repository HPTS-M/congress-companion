
-- Drop existing broken RESTRICTIVE policies
DROP POLICY IF EXISTS "Admins manage org announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated read event announcements" ON announcements;
DROP POLICY IF EXISTS "Superusers manage all announcements" ON announcements;
DROP POLICY IF EXISTS "block_anon_access" ON announcements;

-- Recreate block_anon as RESTRICTIVE (blocks anonymous users)
CREATE POLICY "block_anon_access"
ON announcements FOR SELECT TO anon
USING (false);

-- Recreate others as PERMISSIVE (default) so authenticated users can access
CREATE POLICY "Admins manage org announcements"
ON announcements FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = announcements.event_id
    AND events.organization_id = get_user_organization(auth.uid())
  )
  AND has_org_role(auth.uid(), 'admin', (
    SELECT events.organization_id FROM events WHERE events.id = announcements.event_id
  ))
);

CREATE POLICY "Authenticated read event announcements"
ON announcements FOR SELECT TO authenticated
USING (
  event_id IN (SELECT event_id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Superusers manage all announcements"
ON announcements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'));
