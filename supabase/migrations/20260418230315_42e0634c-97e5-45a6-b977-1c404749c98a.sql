-- Ensure authenticated role has table-level grants on ratings
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;

-- Block anonymous access explicitly
DROP POLICY IF EXISTS "block_anon_ratings" ON public.ratings;
CREATE POLICY "block_anon_ratings"
ON public.ratings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Admins can read & manage ratings for events in their organization
DROP POLICY IF EXISTS "Admins manage org ratings" ON public.ratings;
CREATE POLICY "Admins manage org ratings"
ON public.ratings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = ratings.event_id
      AND has_org_role(auth.uid(), 'admin'::app_role, e.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = ratings.event_id
      AND has_org_role(auth.uid(), 'admin'::app_role, e.organization_id)
  )
);

-- Superusers full access
DROP POLICY IF EXISTS "Superusers manage all ratings" ON public.ratings;
CREATE POLICY "Superusers manage all ratings"
ON public.ratings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role))
WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- Coordinators / field managers assigned to the event can read ratings
DROP POLICY IF EXISTS "Event staff read ratings" ON public.ratings;
CREATE POLICY "Event staff read ratings"
ON public.ratings
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'coordinator'::app_role) OR has_role(auth.uid(), 'field_manager'::app_role))
  AND is_event_staff(auth.uid(), event_id)
);