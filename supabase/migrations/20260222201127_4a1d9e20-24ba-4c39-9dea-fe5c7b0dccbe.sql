CREATE POLICY "Authenticated users can view published events"
ON public.events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (status = 'published' AND deleted_at IS NULL);