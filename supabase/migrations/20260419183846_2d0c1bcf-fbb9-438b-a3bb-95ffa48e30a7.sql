-- 1. Add column for externally-provided credential code
ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS external_credential_code text;

-- 2. Partial unique index: only enforce uniqueness when value is present and attendee is not soft-deleted
CREATE UNIQUE INDEX IF NOT EXISTS attendees_external_code_per_event
  ON public.attendees (event_id, external_credential_code)
  WHERE external_credential_code IS NOT NULL AND deleted_at IS NULL;

-- 3. Helpful lookup index for login flow (event + external code)
CREATE INDEX IF NOT EXISTS attendees_external_code_lookup
  ON public.attendees (external_credential_code)
  WHERE external_credential_code IS NOT NULL;