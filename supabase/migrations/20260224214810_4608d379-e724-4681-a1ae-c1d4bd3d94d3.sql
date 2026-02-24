
-- Create sponsor_leads table
CREATE TABLE public.sponsor_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sponsor_id, attendee_id)
);

-- Enable RLS
ALTER TABLE public.sponsor_leads ENABLE ROW LEVEL SECURITY;

-- Block anon
CREATE POLICY "block_anon_access"
ON public.sponsor_leads FOR SELECT TO anon
USING (false);

-- Attendees can insert their own leads
CREATE POLICY "Attendees insert own leads"
ON public.sponsor_leads FOR INSERT TO authenticated
WITH CHECK (
  attendee_id IN (SELECT get_my_attendee_ids())
  AND event_id IN (SELECT get_my_event_ids())
);

-- Attendees can read their own leads
CREATE POLICY "Attendees read own leads"
ON public.sponsor_leads FOR SELECT TO authenticated
USING (
  attendee_id IN (SELECT get_my_attendee_ids())
);

-- Admins can read all leads for their org events
CREATE POLICY "Admins read org event leads"
ON public.sponsor_leads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = sponsor_leads.event_id
    AND events.organization_id = get_user_organization(auth.uid())
  )
);

-- Superusers full access
CREATE POLICY "Superusers manage all leads"
ON public.sponsor_leads FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Grant table access
GRANT SELECT, INSERT ON public.sponsor_leads TO authenticated;
GRANT SELECT ON public.sponsor_leads TO anon;
