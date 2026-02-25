
-- =============================================
-- POLLS MODULE: 3 tables + RLS
-- =============================================

-- 1. POLLS TABLE
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  session_id uuid REFERENCES public.event_activities(id),
  question text NOT NULL,
  poll_type text NOT NULL DEFAULT 'multiple_choice',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 2. POLL OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  order_index int NOT NULL DEFAULT 0
);

-- 3. POLL RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id),
  attendee_id uuid NOT NULL REFERENCES public.attendees(id),
  option_id uuid REFERENCES public.poll_options(id),
  text_response text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, attendee_id)
);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS: POLLS
-- =============================================

-- Block anon (RESTRICTIVE)
CREATE POLICY "block_anon_polls"
ON public.polls FOR SELECT TO anon
USING (false);

-- Admins manage polls in their org (PERMISSIVE)
CREATE POLICY "Admins manage org polls"
ON public.polls FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = polls.event_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = polls.event_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Attendees read active polls for their event (PERMISSIVE)
CREATE POLICY "Attendees read active polls"
ON public.polls FOR SELECT TO authenticated
USING (
  status = 'active'
  AND event_id IN (SELECT get_my_event_ids())
);

-- Superusers manage all polls (PERMISSIVE)
CREATE POLICY "Superusers manage all polls"
ON public.polls FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role))
WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- =============================================
-- RLS: POLL_OPTIONS
-- =============================================

-- Block anon (RESTRICTIVE)
CREATE POLICY "block_anon_poll_options"
ON public.poll_options FOR SELECT TO anon
USING (false);

-- Admins manage options (PERMISSIVE)
CREATE POLICY "Admins manage poll options"
ON public.poll_options FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.polls p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = poll_options.poll_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.polls p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = poll_options.poll_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Attendees read options of active polls (PERMISSIVE)
CREATE POLICY "Attendees read active poll options"
ON public.poll_options FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_options.poll_id
      AND p.status = 'active'
      AND p.event_id IN (SELECT get_my_event_ids())
  )
);

-- Superusers manage all options (PERMISSIVE)
CREATE POLICY "Superusers manage all poll options"
ON public.poll_options FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role))
WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- =============================================
-- RLS: POLL_RESPONSES
-- =============================================

-- Block anon (RESTRICTIVE)
CREATE POLICY "block_anon_poll_responses"
ON public.poll_responses FOR SELECT TO anon
USING (false);

-- Admins read all responses for their org (PERMISSIVE)
CREATE POLICY "Admins read org poll responses"
ON public.poll_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.polls p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = poll_responses.poll_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Attendees read own responses (PERMISSIVE)
CREATE POLICY "Attendees read own responses"
ON public.poll_responses FOR SELECT TO authenticated
USING (
  attendee_id IN (SELECT get_my_attendee_ids())
);

-- Attendees insert own responses (PERMISSIVE)
CREATE POLICY "Attendees insert own responses"
ON public.poll_responses FOR INSERT TO authenticated
WITH CHECK (
  attendee_id IN (SELECT get_my_attendee_ids())
);

-- Superusers manage all responses (PERMISSIVE)
CREATE POLICY "Superusers manage all poll responses"
ON public.poll_responses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role))
WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- =============================================
-- GRANTS
-- =============================================
GRANT SELECT ON public.polls TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT SELECT ON public.poll_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT SELECT ON public.poll_responses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.poll_responses TO authenticated;

-- Enable realtime for poll_responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_responses;
