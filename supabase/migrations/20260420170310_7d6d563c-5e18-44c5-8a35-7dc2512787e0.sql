-- Fix storage RLS so admins/superusers can read sponsor + document assets
DROP POLICY IF EXISTS "Authenticated read own event sponsor assets" ON storage.objects;

CREATE POLICY "Read event sponsor assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-sponsors'
  AND (
    public.has_role(auth.uid(), 'superuser'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR ((storage.foldername(name))[1])::uuid IN (SELECT public.get_my_event_ids())
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.is_event_staff(auth.uid(), e.id)
    )
  )
);

DROP POLICY IF EXISTS "Authenticated read own event files" ON storage.objects;

CREATE POLICY "Read event documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-documents'
  AND (
    public.has_role(auth.uid(), 'superuser'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR ((storage.foldername(name))[1])::uuid IN (SELECT public.get_my_event_ids())
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.is_event_staff(auth.uid(), e.id)
    )
  )
);