-- 1. UNIQUE INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_event_name_unique
  ON public.service_catalog (event_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS providers_event_email_unique
  ON public.providers (event_id, lower(contact_email))
  WHERE contact_email IS NOT NULL;

-- 2. service_catalog.status
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';

ALTER TABLE public.service_catalog
  DROP CONSTRAINT IF EXISTS service_catalog_status_check;

ALTER TABLE public.service_catalog
  ADD CONSTRAINT service_catalog_status_check
  CHECK (status IN ('scheduled', 'cancelled'));

-- 3. attendee_services.status migration
ALTER TABLE public.attendee_services
  DROP CONSTRAINT IF EXISTS attendee_services_status_check;

ALTER TABLE public.attendee_services
  ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.attendee_services
SET status = 'pending'
WHERE status = 'scheduled' OR status IS NULL;

ALTER TABLE public.attendee_services
  ADD CONSTRAINT attendee_services_status_check
  CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'));

-- 4. View
CREATE OR REPLACE VIEW public.service_catalog_with_status AS
SELECT
  sc.*,
  CASE
    WHEN sc.status = 'cancelled' THEN 'cancelled'
    WHEN sc.valid_until IS NOT NULL
         AND (
           (CURRENT_DATE > COALESCE(
             (SELECT start_date + (sc.valid_day - 1) FROM public.events e WHERE e.id = sc.event_id),
             CURRENT_DATE
           ))
           OR
           (CURRENT_DATE = COALESCE(
             (SELECT start_date + (sc.valid_day - 1) FROM public.events e WHERE e.id = sc.event_id),
             CURRENT_DATE
           ) AND CURRENT_TIME > sc.valid_until)
         )
      THEN 'completed'
    ELSE 'scheduled'
  END AS effective_status
FROM public.service_catalog sc;

GRANT SELECT ON public.service_catalog_with_status TO authenticated;

-- 5. Cascade trigger
CREATE OR REPLACE FUNCTION public.cascade_service_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.attendee_services
    SET status = 'cancelled', updated_at = now()
    WHERE service_catalog_id = NEW.id
      AND status NOT IN ('completed', 'cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_service_cancellation ON public.service_catalog;
CREATE TRIGGER trg_cascade_service_cancellation
  AFTER UPDATE OF status ON public.service_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_service_cancellation();

-- 6. provider_activity_log
CREATE TABLE IF NOT EXISTS public.provider_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'login', 'logout', 'service_view', 'ticket_validate', 'password_change', 'session_check'
  )),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_activity_log_provider
  ON public.provider_activity_log (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_activity_log_event_type
  ON public.provider_activity_log (event_id, activity_type, created_at DESC);

ALTER TABLE public.provider_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_anon_provider_activity_log" ON public.provider_activity_log;
CREATE POLICY "block_anon_provider_activity_log"
  ON public.provider_activity_log FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Admins read org provider activity" ON public.provider_activity_log;
CREATE POLICY "Admins read org provider activity"
  ON public.provider_activity_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = provider_activity_log.event_id
        AND e.organization_id = get_user_organization(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Superusers manage provider activity" ON public.provider_activity_log;
CREATE POLICY "Superusers manage provider activity"
  ON public.provider_activity_log FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superuser'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

DROP POLICY IF EXISTS "Providers insert own activity" ON public.provider_activity_log;
CREATE POLICY "Providers insert own activity"
  ON public.provider_activity_log FOR INSERT TO authenticated
  WITH CHECK (
    provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.provider_activity_log TO authenticated;

-- 7. RPC
CREATE OR REPLACE FUNCTION public.log_provider_activity(
  _activity_type text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _provider_id uuid;
  _event_id uuid;
BEGIN
  SELECT id, event_id INTO _provider_id, _event_id
  FROM public.providers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _provider_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.provider_activity_log (provider_id, event_id, activity_type, metadata)
  VALUES (_provider_id, _event_id, _activity_type, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_provider_activity(text, jsonb) TO authenticated;

-- 8. Purge
CREATE OR REPLACE FUNCTION public.purge_old_provider_activity_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted integer;
BEGIN
  WITH del AS (
    DELETE FROM public.provider_activity_log
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM del;
  RETURN _deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_provider_activity_logs() FROM PUBLIC;