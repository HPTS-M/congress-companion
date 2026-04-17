-- ============================================================
-- SECURITY FIX 1: Restrict attendees directory to non-sensitive fields
-- ============================================================

-- Drop the over-permissive directory policy
DROP POLICY IF EXISTS "Attendees view event directory" ON public.attendees;

-- Replace with: attendees can only see full PII for their accepted contacts
CREATE POLICY "Attendees view accepted contacts"
ON public.attendees
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT c.contact_id FROM public.contacts c
    WHERE c.user_id IN (SELECT public.get_my_attendee_ids())
      AND c.status = 'accepted'
    UNION
    SELECT c.user_id FROM public.contacts c
    WHERE c.contact_id IN (SELECT public.get_my_attendee_ids())
      AND c.status = 'accepted'
  )
);

-- Public directory view: only safe, non-sensitive fields
CREATE OR REPLACE VIEW public.public_attendee_directory
WITH (security_invoker = true) AS
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

-- ============================================================
-- SECURITY FIX 2: Restrict session_interests SELECT to own rows
-- + provide aggregated counts via SECURITY DEFINER RPC
-- ============================================================

DROP POLICY IF EXISTS "Attendees read event interests" ON public.session_interests;
DROP POLICY IF EXISTS "Attendees view event interests" ON public.session_interests;

CREATE POLICY "Attendees read own interests"
ON public.session_interests
FOR SELECT
TO authenticated
USING (user_id IN (SELECT public.get_my_attendee_ids()));

-- Aggregated counts function (returns only counts, no user identifiers)
CREATE OR REPLACE FUNCTION public.get_session_interest_counts(_event_id uuid)
RETURNS TABLE(session_id uuid, interest_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT si.session_id, COUNT(*)::bigint
  FROM public.session_interests si
  WHERE si.event_id = _event_id
    AND _event_id IN (SELECT public.get_my_event_ids())
  GROUP BY si.session_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_interest_counts(uuid) TO authenticated;