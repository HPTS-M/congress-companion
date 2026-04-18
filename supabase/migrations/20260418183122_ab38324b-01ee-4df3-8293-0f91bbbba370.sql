CREATE OR REPLACE FUNCTION public.create_attendee_credential(_attendee_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_code TEXT;
BEGIN
  _new_code := 'MCONG-' ||
    TO_CHAR(now(), 'YYYYMMDD') || '-' ||
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT || _attendee_id::TEXT) FROM 1 FOR 8));

  UPDATE public.attendees
  SET credential_code = _new_code,
      updated_at = now()
  WHERE id = _attendee_id;

  RETURN _new_code;
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_documents_event_title_lower
  ON public.documents (event_id, lower(title));