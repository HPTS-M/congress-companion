
-- Drop the security definer view — bad pattern
DROP VIEW IF EXISTS public.attendees_safe;

-- Instead, revoke direct SELECT on access_code_hash is not possible in PostgreSQL
-- at column level with RLS. The proper fix is:
-- 1. The edge function already handles hash validation server-side ✓
-- 2. Frontend code must never SELECT access_code_hash ✓ (enforced in service layer)
-- 3. As extra protection, we can use a column-level GRANT/REVOKE approach

-- Revoke column-level access to access_code_hash for anon and authenticated roles
REVOKE ALL ON public.attendees FROM anon;
REVOKE ALL ON public.attendees FROM authenticated;

-- Re-grant SELECT on all columns EXCEPT access_code_hash
GRANT SELECT (
  id, event_id, full_name, email, phone,
  document_type, document_number,
  credential_code, registration_status,
  selected_package_id, user_id,
  check_in_date, registration_date,
  notes, created_at, updated_at, deleted_at
) ON public.attendees TO authenticated;

-- Grant INSERT, UPDATE, DELETE on the table (RLS will handle row filtering)
GRANT INSERT, UPDATE, DELETE ON public.attendees TO authenticated;

-- No access for anon role to attendees at all
-- (access code verification goes through edge function with service_role)
