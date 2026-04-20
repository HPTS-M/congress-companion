-- 1. Replace unique index on service_catalog
DROP INDEX IF EXISTS public.service_catalog_event_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_event_name_type_time_unique
  ON public.service_catalog (
    event_id,
    lower(name),
    service_type,
    COALESCE(valid_from, '00:00:00'::time),
    COALESCE(valid_until, '00:00:00'::time)
  );

-- 2. cancelled_at column
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 3. Trigger function to auto-set / clear cancelled_at
CREATE OR REPLACE FUNCTION public.set_service_cancelled_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_service_cancelled_at ON public.service_catalog;
CREATE TRIGGER trg_set_service_cancelled_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_cancelled_at();