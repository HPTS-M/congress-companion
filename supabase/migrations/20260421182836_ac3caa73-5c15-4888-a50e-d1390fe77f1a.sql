-- Add starts_at / ends_at to service_catalog
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz;

-- Backfill from valid_day + valid_from/valid_until + events.start_date
UPDATE public.service_catalog sc
SET starts_at = ((e.start_date + (COALESCE(sc.valid_day,1) - 1))::timestamp + COALESCE(sc.valid_from,'00:00')::time)::timestamptz,
    ends_at   = ((e.start_date + (COALESCE(sc.valid_day,1) - 1))::timestamp + COALESCE(sc.valid_until,'23:59')::time)::timestamptz
FROM public.events e
WHERE sc.event_id = e.id
  AND sc.starts_at IS NULL;

-- Recreate view to compute effective_status using new columns
DROP VIEW IF EXISTS public.service_catalog_with_status;

CREATE VIEW public.service_catalog_with_status
WITH (security_invoker = true)
AS
SELECT
  sc.*,
  CASE
    WHEN sc.status = 'cancelled' THEN 'cancelled'
    WHEN sc.ends_at IS NOT NULL AND sc.ends_at < now() THEN 'completed'
    ELSE 'scheduled'
  END AS effective_status
FROM public.service_catalog sc;