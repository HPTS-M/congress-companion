-- Tabla de bitácora de envíos de invitaciones
CREATE TABLE public.invitation_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  reason text,
  error_message text,
  retries integer NOT NULL DEFAULT 0,
  attempted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitation_log_attendee_attempted
  ON public.invitation_send_log(attendee_id, attempted_at DESC);

CREATE INDEX idx_invitation_log_event_status
  ON public.invitation_send_log(event_id, status, attempted_at DESC);

ALTER TABLE public.invitation_send_log ENABLE ROW LEVEL SECURITY;

-- Bloqueo total para anon
CREATE POLICY "block_anon_invitation_log"
  ON public.invitation_send_log
  FOR SELECT TO anon
  USING (false);

-- Admin/superuser de la org del evento puede leer
CREATE POLICY "Admins read own org invitation logs"
  ON public.invitation_send_log
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE public.has_role(auth.uid(), 'superuser'::public.app_role)
         OR public.has_org_role(auth.uid(), 'admin'::public.app_role, e.organization_id)
    )
  );

-- Solo service_role escribe
CREATE POLICY "Service writes invitation logs"
  ON public.invitation_send_log
  FOR INSERT TO service_role
  WITH CHECK (true);

GRANT SELECT ON public.invitation_send_log TO authenticated;
GRANT INSERT ON public.invitation_send_log TO service_role;

-- RPC: IDs de asistentes con último intento fallido (sin envíos exitosos)
CREATE OR REPLACE FUNCTION public.get_failed_invitation_attendee_ids(_event_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT a.id
  FROM public.attendees a
  WHERE a.event_id = _event_id
    AND a.deleted_at IS NULL
    AND a.registration_status IS DISTINCT FROM 'cancelled'
    AND a.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.invitation_send_log l
      WHERE l.attendee_id = a.id AND l.status = 'sent'
    )
    AND EXISTS (
      SELECT 1 FROM public.invitation_send_log l
      WHERE l.attendee_id = a.id AND l.status = 'failed'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_failed_invitation_attendee_ids(uuid) TO authenticated;