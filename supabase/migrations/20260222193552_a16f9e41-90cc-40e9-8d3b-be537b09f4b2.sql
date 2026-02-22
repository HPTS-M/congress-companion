
-- Drop the restrictive block_anon_access policy on events
DROP POLICY IF EXISTS "block_anon_access" ON public.events;

-- Create permissive policy allowing anon to read published events
CREATE POLICY "Anon can view published events"
ON public.events
FOR SELECT
TO anon
USING (status = 'published' AND deleted_at IS NULL);
