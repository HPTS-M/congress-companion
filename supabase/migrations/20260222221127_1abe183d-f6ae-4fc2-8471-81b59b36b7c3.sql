
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  service_type text NOT NULL,
  valid_from time,
  valid_until time,
  valid_day integer,
  location text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.service_catalog FOR SELECT TO anon USING (false);

CREATE POLICY "Authenticated read event catalog" ON public.service_catalog FOR SELECT TO authenticated
USING (event_id IN (SELECT event_id FROM attendees WHERE user_id = auth.uid()));

CREATE POLICY "Superusers manage all catalog" ON public.service_catalog FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

ALTER TABLE public.attendee_services ADD CONSTRAINT fk_service_catalog
  FOREIGN KEY (service_catalog_id) REFERENCES public.service_catalog(id);
