
-- Org admins can manage service_tickets in their organization
CREATE POLICY "Admins manage org service tickets"
ON public.service_tickets FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM attendee_services aser
    JOIN attendees a ON a.id = aser.attendee_id
    JOIN events e ON e.id = a.event_id
    WHERE aser.id = service_tickets.attendee_service_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM attendee_services aser
    JOIN attendees a ON a.id = aser.attendee_id
    JOIN events e ON e.id = a.event_id
    WHERE aser.id = service_tickets.attendee_service_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);
