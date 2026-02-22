
-- =============================================
-- Phase 3: All 9 migrations combined
-- =============================================

-- MIGRATION 1 — sponsors
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('gold','silver','bronze','exhibitor')),
  category text NOT NULL CHECK (category IN 
    ('pharmaceutical','technology','medical_equipment','services','education','other')),
  description text,
  stand_location text,
  logo_url text,
  website_url text,
  materials_url text,
  contact_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.sponsors
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Authenticated read event sponsors" ON public.sponsors
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

CREATE POLICY "Superusers manage all sponsors" ON public.sponsors
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

CREATE POLICY "Admins manage org sponsors" ON public.sponsors
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = sponsors.event_id
  AND events.organization_id = get_user_organization(auth.uid())
) AND has_org_role(auth.uid(), 'admin'::app_role, (
  SELECT organization_id FROM events WHERE events.id = sponsors.event_id
)));

-- MIGRATION 2 — documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id uuid REFERENCES event_activities(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  file_type text CHECK (file_type IN ('pdf','pptx','doc','xlsx','other')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.documents
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Authenticated read event documents" ON public.documents
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

CREATE POLICY "Superusers manage all documents" ON public.documents
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

CREATE POLICY "Admins manage org documents" ON public.documents
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = documents.event_id
  AND events.organization_id = get_user_organization(auth.uid())
) AND has_org_role(auth.uid(), 'admin'::app_role, (
  SELECT organization_id FROM events WHERE events.id = documents.event_id
)));

-- MIGRATION 3 — attendee_notes
CREATE TABLE public.attendee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  session_id uuid REFERENCES event_activities(id) ON DELETE SET NULL,
  content text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.attendee_notes
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Attendees manage own notes" ON public.attendee_notes
FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

-- MIGRATION 4 — contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.contacts
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Attendees manage own contacts" ON public.contacts
FOR ALL TO authenticated
USING (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
  OR contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
)
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

-- MIGRATION 5 — session_interests
CREATE TABLE public.session_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, session_id)
);

ALTER TABLE public.session_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.session_interests
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Attendees read event interests" ON public.session_interests
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

CREATE POLICY "Attendees manage own interests" ON public.session_interests
FOR INSERT TO authenticated
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

CREATE POLICY "Attendees delete own interests" ON public.session_interests
FOR DELETE TO authenticated
USING (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

-- MIGRATION 6 — ratings
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, session_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.ratings
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Attendees manage own ratings" ON public.ratings
FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

-- MIGRATION 7 — announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  reach text DEFAULT 'all',
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.announcements
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Authenticated read event announcements" ON public.announcements
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

CREATE POLICY "Superusers manage all announcements" ON public.announcements
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

CREATE POLICY "Admins manage org announcements" ON public.announcements
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = announcements.event_id
  AND events.organization_id = get_user_organization(auth.uid())
) AND has_org_role(auth.uid(), 'admin'::app_role, (
  SELECT organization_id FROM events WHERE events.id = announcements.event_id
)));

-- MIGRATION 8 — push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  subscription_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access" ON public.push_subscriptions
AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE POLICY "Attendees manage own push subscriptions" ON public.push_subscriptions
FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

-- MIGRATION 9 — Storage bucket "event-documents"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-documents',
  'event-documents',
  false,
  52428800,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png']
);

CREATE POLICY "Authenticated read own event files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'event-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT event_id::text FROM attendees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins upload event files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-documents'
  AND (has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins delete event files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'event-documents'
  AND (has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role))
);
