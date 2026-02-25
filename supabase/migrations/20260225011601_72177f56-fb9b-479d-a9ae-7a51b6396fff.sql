
-- Paso 1: Crear función SECURITY DEFINER para proveedores (rompe recursión)
CREATE OR REPLACE FUNCTION public.get_provider_attendee_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT aser.attendee_id
  FROM public.attendee_services aser
  JOIN public.provider_services ps ON ps.service_catalog_id = aser.service_catalog_id
  JOIN public.providers p ON p.id = ps.provider_id
  WHERE p.user_id = auth.uid();
$$;

-- Paso 2: Reemplazar política recursiva en attendees
DROP POLICY IF EXISTS "Providers read attendees for assigned services" ON public.attendees;

CREATE POLICY "Providers read attendees for assigned services"
ON public.attendees FOR SELECT TO authenticated
USING (id IN (SELECT public.get_provider_attendee_ids()));

-- Paso 3: Corregir block_anon_access en announcements (RESTRICTIVE)
DROP POLICY IF EXISTS "block_anon_access" ON public.announcements;

CREATE POLICY "block_anon_access"
ON public.announcements AS RESTRICTIVE FOR SELECT TO anon
USING (false);

-- Paso 4: Optimizar announcements para usar get_my_event_ids()
DROP POLICY IF EXISTS "Authenticated read event announcements" ON public.announcements;

CREATE POLICY "Authenticated read event announcements"
ON public.announcements FOR SELECT TO authenticated
USING (event_id IN (SELECT public.get_my_event_ids()));
