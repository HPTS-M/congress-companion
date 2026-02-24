
-- Grant permissions on attendee_notes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendee_notes TO authenticated;
GRANT SELECT ON public.attendee_notes TO anon;

-- Fix RLS: drop restrictive policy and create permissive
DROP POLICY IF EXISTS "Attendees manage own notes" ON public.attendee_notes;
CREATE POLICY "Attendees manage own notes"
ON public.attendee_notes FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM public.attendees WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM public.attendees WHERE user_id = auth.uid()));

-- Insert test notes
INSERT INTO public.attendee_notes (event_id, user_id, session_id, content, updated_at)
VALUES 
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 
   (SELECT id FROM public.event_activities WHERE event_id = '5efca36a-deef-489b-be85-3dc9d1501ed7' AND title ILIKE '%oncolog%' LIMIT 1),
   'Puntos clave sobre trasplante de médula ósea. Rol del farmacéutico en fases pre y postrasplante. Seguir up con Diana Uribe.', now()),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 
   NULL,
   'Contactar a Cecilia Martínez para más información sobre el modelo SEFH España.', now());
