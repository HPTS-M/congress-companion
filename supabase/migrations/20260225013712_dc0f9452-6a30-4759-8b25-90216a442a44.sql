
-- Create staff_members table
CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  user_id uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  assigned_room text,
  contact_email text NOT NULL,
  invitation_status text DEFAULT 'pending',
  last_login timestamptz,
  access_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Block anon access (RESTRICTIVE)
CREATE POLICY "block_anon_staff"
ON public.staff_members AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Admins manage staff in their org
CREATE POLICY "Admins manage staff"
ON public.staff_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = staff_members.event_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = staff_members.event_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Staff can read own record
CREATE POLICY "Staff read own record"
ON public.staff_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Superusers manage all
CREATE POLICY "Superusers manage all staff"
ON public.staff_members FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT SELECT ON public.staff_members TO anon;
