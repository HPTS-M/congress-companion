
-- Allow org admins to manage service catalog entries
CREATE POLICY "Admins manage org service catalog"
ON public.service_catalog FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = service_catalog.event_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = service_catalog.event_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);
