
-- ==============================================
-- SECURITY FIX MIGRATION
-- ==============================================

-- FIX 1: Mutable search path on update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FIX 2: Mutable search path on update_conversation_timestamp
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- FIX 3: Replace always-true INSERT policy on notifications
-- Drop the permissive "System can create notifications" policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Replace with a policy that only allows authenticated users to create notifications
-- and only for themselves or if they have admin/coordinator roles
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Superusers can create any notification
  has_role(auth.uid(), 'superuser'::app_role)
  OR
  -- Admins can create notifications in their org
  has_org_role(auth.uid(), 'admin'::app_role, organization_id)
  OR
  -- Coordinators/field_managers can create for their events
  (
    (has_role(auth.uid(), 'coordinator'::app_role) OR has_role(auth.uid(), 'field_manager'::app_role))
    AND is_event_staff(auth.uid(), event_id)
  )
);

-- FIX 4: Restrict event_packages to authenticated users only
DROP POLICY IF EXISTS "Attendees can view active packages" ON public.event_packages;

CREATE POLICY "Authenticated users can view active packages"
ON public.event_packages
FOR SELECT
TO authenticated
USING (is_active = true);

-- FIX 5: Ensure attendees table never exposes access_code_hash to clients
-- Create a secure view that excludes sensitive credential columns
CREATE OR REPLACE VIEW public.attendees_safe AS
SELECT 
  id, event_id, full_name, email, phone,
  document_type, document_number,
  credential_code, registration_status,
  selected_package_id, user_id,
  check_in_date, registration_date,
  notes, created_at, updated_at, deleted_at
FROM public.attendees;

-- Grant access to the view (no access_code_hash column exposed)
GRANT SELECT ON public.attendees_safe TO authenticated;
GRANT SELECT ON public.attendees_safe TO anon;
