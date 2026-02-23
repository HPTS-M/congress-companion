
-- Step 1: Create SECURITY DEFINER helper functions
CREATE OR REPLACE FUNCTION public.get_my_attendee_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.attendees
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_my_event_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT event_id FROM public.attendees
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_attendee_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_attendee_ids TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_event_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_event_ids TO authenticated;

-- Step 2: Fix attendees directory policy
DROP POLICY IF EXISTS "Attendees view event directory" ON public.attendees;

CREATE POLICY "Attendees view event directory"
ON public.attendees FOR SELECT TO authenticated
USING (
  event_id IN (SELECT public.get_my_event_ids())
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);

-- Step 3: Fix all contacts policies
DROP POLICY IF EXISTS "Authenticated read own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Attendees manage own contacts" ON public.contacts;

CREATE POLICY "Authenticated read own contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  user_id IN (SELECT public.get_my_attendee_ids())
  OR contact_id IN (SELECT public.get_my_attendee_ids())
);

CREATE POLICY "Authenticated insert contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  user_id IN (SELECT public.get_my_attendee_ids())
);

CREATE POLICY "Authenticated update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (
  contact_id IN (SELECT public.get_my_attendee_ids())
);

CREATE POLICY "Authenticated delete contacts"
ON public.contacts FOR DELETE TO authenticated
USING (
  user_id IN (SELECT public.get_my_attendee_ids())
  OR contact_id IN (SELECT public.get_my_attendee_ids())
);
