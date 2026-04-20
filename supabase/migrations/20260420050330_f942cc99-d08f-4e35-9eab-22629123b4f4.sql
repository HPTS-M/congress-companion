-- 1) Fix RLS speaker-photos: usar storage.objects.name (path del archivo), no e.name
DROP POLICY IF EXISTS "Admins manage speaker photos" ON storage.objects;

CREATE POLICY "Admins manage speaker photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'speaker-photos'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'speaker-photos'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
);

-- 2) Bucket constraints
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'speaker-photos';

-- 3) Permitir PPT clásico en event-documents
UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT ARRAY(SELECT DISTINCT unnest(coalesce(allowed_mime_types, ARRAY[]::text[]) || ARRAY['application/vnd.ms-powerpoint']))
)
WHERE id = 'event-documents';

-- 4) Columna status en event_activities (solo 'cancelled' o NULL)
ALTER TABLE public.event_activities
  ADD COLUMN IF NOT EXISTS status text DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_activities_status_check'
  ) THEN
    ALTER TABLE public.event_activities
      ADD CONSTRAINT event_activities_status_check
      CHECK (status IS NULL OR status = 'cancelled');
  END IF;
END $$;