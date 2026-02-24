
-- ============================================
-- Providers module: tables + RLS + RPC functions
-- ============================================

-- 1. Providers table
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  category text NOT NULL,
  access_code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Provider ↔ Service Catalog junction
CREATE TABLE IF NOT EXISTS public.provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_catalog_id uuid NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider_id, service_catalog_id)
);

-- 3. Enable RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

-- 4. Block anon access
CREATE POLICY "block_anon_providers"
ON public.providers FOR SELECT TO anon USING (false);

CREATE POLICY "block_anon_provider_services"
ON public.provider_services FOR SELECT TO anon USING (false);

-- 5. Admin policies
CREATE POLICY "Admins manage org providers"
ON public.providers FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = providers.event_id
    AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = providers.event_id
    AND e.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Superusers manage all providers"
ON public.providers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

CREATE POLICY "Admins manage org provider_services"
ON public.provider_services FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM providers p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = provider_services.provider_id
    AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM providers p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = provider_services.provider_id
    AND e.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Superusers manage all provider_services"
ON public.provider_services FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

-- 6. RPC: Verify provider access code (anon-safe via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.verify_provider_access(
  _access_code text,
  _event_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  SELECT p.id, p.company_name, p.category, p.event_id,
         e.name as event_name, e.event_code
  INTO provider_record
  FROM providers p
  JOIN events e ON e.id = p.event_id
  WHERE p.access_code = _access_code
    AND e.event_code = _event_code
    AND p.is_active = true
    AND e.deleted_at IS NULL
    AND e.status = 'published';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'provider', jsonb_build_object(
      'id', provider_record.id,
      'company_name', provider_record.company_name,
      'category', provider_record.category,
      'event_id', provider_record.event_id
    ),
    'event', jsonb_build_object(
      'name', provider_record.event_name,
      'event_code', provider_record.event_code
    )
  );
END;
$$;

-- 7. RPC: Get provider's assigned services with attendee counts
CREATE OR REPLACE FUNCTION public.get_provider_assigned_services(_provider_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sc.id,
      'name', sc.name,
      'service_type', sc.service_type,
      'valid_day', sc.valid_day,
      'valid_from', sc.valid_from,
      'valid_until', sc.valid_until,
      'location', sc.location,
      'attendee_count', (
        SELECT COUNT(*) FROM attendee_services aser
        WHERE aser.service_catalog_id = sc.id
      )
    )
    ORDER BY sc.name
  ), '[]'::jsonb)
  FROM provider_services ps
  JOIN service_catalog sc ON sc.id = ps.service_catalog_id
  WHERE ps.provider_id = _provider_id;
$$;

-- 8. RPC: Get attendees for a service (provider portal, validates access)
CREATE OR REPLACE FUNCTION public.get_provider_service_attendees(
  _provider_id uuid,
  _service_catalog_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM provider_services
    WHERE provider_id = _provider_id
    AND service_catalog_id = _service_catalog_id
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'attendee_service_id', aser.id,
        'attendee_name', a.full_name,
        'credential_code', a.credential_code,
        'status', aser.status,
        'ticket_code', st.ticket_code,
        'is_used', COALESCE(st.is_used, false),
        'used_at', st.used_at
      )
      ORDER BY a.full_name
    ), '[]'::jsonb)
    FROM attendee_services aser
    JOIN attendees a ON a.id = aser.attendee_id
    LEFT JOIN service_tickets st ON st.attendee_service_id = aser.id
    WHERE aser.service_catalog_id = _service_catalog_id
    AND a.deleted_at IS NULL
  );
END;
$$;

-- 9. RPC: Provider validates a ticket
CREATE OR REPLACE FUNCTION public.provider_validate_ticket(
  _provider_id uuid,
  _attendee_service_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_catalog_id uuid;
  v_ticket RECORD;
BEGIN
  SELECT aser.service_catalog_id INTO v_service_catalog_id
  FROM attendee_services aser
  WHERE aser.id = _attendee_service_id;

  IF NOT EXISTS (
    SELECT 1 FROM provider_services
    WHERE provider_id = _provider_id
    AND service_catalog_id = v_service_catalog_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT * INTO v_ticket
  FROM service_tickets
  WHERE attendee_service_id = _attendee_service_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already used', 'used_at', v_ticket.used_at);
  END IF;

  UPDATE service_tickets
  SET is_used = true, used_at = now()
  WHERE attendee_service_id = _attendee_service_id;

  UPDATE attendee_services
  SET status = 'completed'
  WHERE id = _attendee_service_id;

  RETURN jsonb_build_object('success', true, 'message', 'Ticket validado');
END;
$$;
