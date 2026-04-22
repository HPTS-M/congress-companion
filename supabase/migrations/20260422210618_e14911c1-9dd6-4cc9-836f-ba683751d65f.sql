ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS access_code_lookup TEXT;

CREATE INDEX IF NOT EXISTS idx_attendees_event_lookup
  ON public.attendees (event_id, access_code_lookup)
  WHERE access_code_lookup IS NOT NULL AND deleted_at IS NULL;