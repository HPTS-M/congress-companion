-- Allow organization admins to delete poll responses for polls in their organization
CREATE POLICY "Admins delete org poll responses"
ON public.poll_responses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.polls p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = poll_responses.poll_id
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Allow organization admins to delete poll options for polls in their organization
CREATE POLICY "Admins delete org poll options"
ON public.poll_options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.polls p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = poll_options.poll_id
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
);