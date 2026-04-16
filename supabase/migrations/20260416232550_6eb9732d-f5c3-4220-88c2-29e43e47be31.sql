-- Add new columns to event_activities
ALTER TABLE public.event_activities
  ADD COLUMN IF NOT EXISTS speaker_photo_url text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_event_activities_archived_at
  ON public.event_activities (event_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_event_activities_sort_order
  ON public.event_activities (event_id, scheduled_date, sort_order);

-- Create private storage bucket for speaker photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('speaker-photos', 'speaker-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for speaker-photos bucket
-- Admins (org-scoped) can manage photos in their org events
DROP POLICY IF EXISTS "Admins manage speaker photos" ON storage.objects;
CREATE POLICY "Admins manage speaker photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'speaker-photos'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'speaker-photos'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Superusers can manage all speaker photos
DROP POLICY IF EXISTS "Superusers manage speaker photos" ON storage.objects;
CREATE POLICY "Superusers manage speaker photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'speaker-photos'
  AND public.has_role(auth.uid(), 'superuser'::public.app_role)
)
WITH CHECK (
  bucket_id = 'speaker-photos'
  AND public.has_role(auth.uid(), 'superuser'::public.app_role)
);

-- Attendees of the event can read speaker photos for their event
DROP POLICY IF EXISTS "Attendees read speaker photos" ON storage.objects;
CREATE POLICY "Attendees read speaker photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'speaker-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT event_id::text FROM public.attendees
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);