-- Index to speed up duplicate name checks per event
CREATE INDEX IF NOT EXISTS idx_sponsors_event_lower_name
ON public.sponsors (event_id, lower(name));

-- Track when a sponsor lead was contacted by the organizer
ALTER TABLE public.sponsor_leads
ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

-- RPC to mark a lead as contacted, restricted to org admins / superusers
CREATE OR REPLACE FUNCTION public.mark_lead_contacted(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
  _org_id uuid;
BEGIN
  SELECT sl.event_id, e.organization_id
    INTO _event_id, _org_id
  FROM public.sponsor_leads sl
  JOIN public.events e ON e.id = sl.event_id
  WHERE sl.id = _lead_id;

  IF _event_id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'superuser'::app_role)
    OR public.has_org_role(auth.uid(), 'admin'::app_role, _org_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.sponsor_leads
  SET contacted_at = now()
  WHERE id = _lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_lead_contacted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lead_contacted(uuid) TO authenticated;