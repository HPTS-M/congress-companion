
-- 1a. Add specialty and institution columns to attendees
ALTER TABLE public.attendees 
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS institution text;

-- 1b. PERMISSIVE policy for attendee directory (authenticated users see same-event attendees)
CREATE POLICY "Attendees view event directory"
ON public.attendees FOR SELECT TO authenticated
USING (
  event_id IN (
    SELECT a.event_id FROM public.attendees a WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL
  )
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);

-- 1c. PERMISSIVE policies for contacts table
CREATE POLICY "Authenticated read own contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
  OR contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated insert contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (
  contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated delete contacts"
ON public.contacts FOR DELETE TO authenticated
USING (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
  OR contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

-- 1d. Insert 5 test attendees
INSERT INTO public.attendees (event_id, full_name, email, credential_code, registration_status, specialty, institution)
VALUES
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'María González', 'maria.gonzalez@test.com', 'TEST-DIR-00001', 'confirmed', 'Farmacéutica Clínica', 'Hospital San Vicente'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Carlos Restrepo', 'carlos.restrepo@test.com', 'TEST-DIR-00002', 'confirmed', 'Regente de Farmacia', 'Clínica Las Américas'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Ana Martínez', 'ana.martinez@test.com', 'TEST-DIR-00003', 'confirmed', 'Investigadora', 'Universidad de Antioquia'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Juan Pérez', 'juan.perez@test.com', 'TEST-DIR-00004', 'confirmed', 'Director de Farmacia', 'Hospital Pablo Tobón Uribe'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Laura Cano', 'laura.cano@test.com', 'TEST-DIR-00005', 'confirmed', 'Farmacéutica Hospitalaria', 'Clínica Medellín');
