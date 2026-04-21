-- 1. Add validation_method column to service_tickets
ALTER TABLE public.service_tickets
ADD COLUMN IF NOT EXISTS validation_method text DEFAULT 'qr'
CHECK (validation_method IN ('qr', 'manual_admin'));

-- 2. Sync trigger function: attendee_services.status → service_tickets
CREATE OR REPLACE FUNCTION public.sync_attendee_service_to_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on status changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Mark as used (manual admin validation)
    IF NEW.status IN ('completed', 'used') AND OLD.status NOT IN ('completed', 'used') THEN
      UPDATE public.service_tickets
      SET is_used = true,
          used_at = now(),
          validated_by = auth.uid(),
          validation_method = 'manual_admin'
      WHERE attendee_service_id = NEW.id
        AND COALESCE(is_used, false) = false;
    -- Revert to unused
    ELSIF NEW.status IN ('scheduled', 'pending') AND OLD.status IN ('completed', 'used') THEN
      UPDATE public.service_tickets
      SET is_used = false,
          used_at = NULL,
          validated_by = NULL,
          validation_method = 'qr'
      WHERE attendee_service_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create trigger
DROP TRIGGER IF EXISTS trg_sync_attendee_service_to_ticket ON public.attendee_services;
CREATE TRIGGER trg_sync_attendee_service_to_ticket
AFTER UPDATE OF status ON public.attendee_services
FOR EACH ROW
EXECUTE FUNCTION public.sync_attendee_service_to_ticket();