-- ============ POLLS ============
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS results_visibility text NOT NULL DEFAULT 'admin_only',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger updated_at on polls
CREATE OR REPLACE FUNCTION public.update_polls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_polls_updated_at ON public.polls;
CREATE TRIGGER trg_polls_updated_at
BEFORE UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.update_polls_updated_at();

-- ============ POLL OPTIONS: is_active ============
ALTER TABLE public.poll_options
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============ Aggregate RPC (admin only) ============
CREATE OR REPLACE FUNCTION public.get_poll_aggregate(_poll_id uuid)
RETURNS TABLE (
  option_id uuid,
  option_text text,
  response_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
  _org_id uuid;
BEGIN
  SELECT p.event_id INTO _event_id FROM public.polls p WHERE p.id = _poll_id;
  IF _event_id IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;
  SELECT e.organization_id INTO _org_id FROM public.events e WHERE e.id = _event_id;

  IF NOT (
    public.has_role(auth.uid(), 'superuser'::app_role)
    OR public.has_org_role(auth.uid(), 'admin'::app_role, _org_id)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    o.id AS option_id,
    o.option_text,
    COUNT(r.id)::bigint AS response_count
  FROM public.poll_options o
  LEFT JOIN public.poll_responses r ON r.option_id = o.id
  WHERE o.poll_id = _poll_id
  GROUP BY o.id, o.option_text, o.order_index
  ORDER BY o.order_index;
END;
$$;

REVOKE ALL ON FUNCTION public.get_poll_aggregate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_poll_aggregate(uuid) TO authenticated;

-- ============ STAFF: is_active ============
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;