

# Phase 3 — Database Migrations (Corrected)

## Critical Fix Applied to All Policies

The user's proposed SQL references `attendees.id = auth.uid()`, but `auth.uid()` maps to `attendees.user_id` (the Supabase Auth ID), not `attendees.id` (the attendee record UUID).

**All policies corrected to use:** `attendees.user_id = auth.uid()` instead of `attendees.id = auth.uid()`

For tables where `user_id REFERENCES attendees(id)`, the RLS must resolve through a subquery:
```text
user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
```

---

## Migration 1 — sponsors

```sql
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

-- Block anon
CREATE POLICY "block_anon_access" ON public.sponsors
AS RESTRICTIVE FOR SELECT TO anon USING (false);

-- Authenticated attendees read their event's sponsors
CREATE POLICY "Authenticated read event sponsors" ON public.sponsors
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

-- Admin/superuser manage
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
```

## Migration 2 — documents

```sql
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
```

## Migration 3 — attendee_notes

`user_id` here references `attendees(id)`, so RLS must resolve through subquery.

```sql
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
```

## Migration 4 — contacts

```sql
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
```

## Migration 5 — session_interests

```sql
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

-- Read: all attendees of same event can see interest counts
CREATE POLICY "Attendees read event interests" ON public.session_interests
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

-- Write: only own interests
CREATE POLICY "Attendees manage own interests" ON public.session_interests
FOR INSERT TO authenticated
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));

CREATE POLICY "Attendees delete own interests" ON public.session_interests
FOR DELETE TO authenticated
USING (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));
```

## Migration 6 — ratings

```sql
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
```

## Migration 7 — announcements

```sql
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  reach text DEFAULT 'all',
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Block anon (no public access to announcements)
CREATE POLICY "block_anon_access" ON public.announcements
AS RESTRICTIVE FOR SELECT TO anon USING (false);

-- Authenticated attendees read their event's announcements
CREATE POLICY "Authenticated read event announcements" ON public.announcements
FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

-- Admin/superuser manage
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
```

## Migration 8 — push_subscriptions

```sql
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
```

## Migration 9 — Storage bucket "event-documents"

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-documents',
  'event-documents',
  false,
  52428800,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png']
);

-- Authenticated users can read files from their event folder
CREATE POLICY "Authenticated read own event files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'event-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT event_id::text FROM attendees WHERE user_id = auth.uid()
  )
);

-- Admin/superuser can upload files
CREATE POLICY "Admins upload event files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-documents'
  AND (has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role))
);

-- Admin/superuser can delete files
CREATE POLICY "Admins delete event files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'event-documents'
  AND (has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role))
);
```

---

## Post-Migration

After all 9 migrations are applied, a security scan will be run and results shared.

## Summary of Corrections vs. Original Proposal

| Original | Corrected | Reason |
|---|---|---|
| `WHERE id = auth.uid()` | `WHERE user_id = auth.uid()` | `attendees.id` is not the auth UID |
| `user_id = auth.uid()` on attendee-ref tables | `user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())` | `user_id` references `attendees(id)`, not the auth UID |
| Anon SELECT on announcements | Blocked anon, authenticated only | Attendees are always authenticated; anon access unnecessary |
| Missing admin policies | Added superuser + admin policies on sponsors, documents, announcements | Admins need write access for content management |

