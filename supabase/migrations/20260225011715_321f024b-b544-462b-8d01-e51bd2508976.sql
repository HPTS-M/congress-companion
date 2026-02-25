
-- Fix: Admin and Superuser policies on announcements must be PERMISSIVE
-- Otherwise admins get 0 rows (RESTRICTIVE only narrows, doesn't grant)

DROP POLICY IF EXISTS "Admins manage org announcements" ON public.announcements;

CREATE POLICY "Admins manage org announcements"
ON public.announcements FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = announcements.event_id
      AND events.organization_id = get_user_organization(auth.uid())
  )
  AND has_org_role(auth.uid(), 'admin'::app_role, (
    SELECT events.organization_id FROM events WHERE events.id = announcements.event_id
  ))
);

DROP POLICY IF EXISTS "Superusers manage all announcements" ON public.announcements;

CREATE POLICY "Superusers manage all announcements"
ON public.announcements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));
