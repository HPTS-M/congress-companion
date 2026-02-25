
-- Add PERMISSIVE policy for admins to manage checkins in their org
CREATE POLICY "Admins manage org checkins"
ON public.attendee_checkins FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_activities act
    JOIN events e ON e.id = act.event_id
    WHERE act.id = attendee_checkins.activity_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Fix block_anon_access: drop RESTRICTIVE and re-create to ensure it's truly RESTRICTIVE for ALL commands
DROP POLICY IF EXISTS "block_anon_access" ON public.attendee_checkins;
CREATE POLICY "block_anon_access"
ON public.attendee_checkins AS RESTRICTIVE FOR ALL TO anon
USING (false)
WITH CHECK (false);
