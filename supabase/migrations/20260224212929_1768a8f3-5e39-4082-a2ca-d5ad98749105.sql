
-- Storage bucket for sponsor logos and materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-sponsors', 'event-sponsors', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for event-sponsors bucket
CREATE POLICY "Admins can upload sponsor assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-sponsors'
  AND (
    has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can update sponsor assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-sponsors'
  AND (
    has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can delete sponsor assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-sponsors'
  AND (
    has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Authenticated can view sponsor assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-sponsors');

-- Add interaction stats columns to sponsors table
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS profile_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_downloads integer NOT NULL DEFAULT 0;
