
-- ERROR 1: profiles table — add authenticated SELECT
CREATE POLICY "Authenticated users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

-- ERROR 2: All pre-Phase-3 tables with block_anon_access but missing PERMISSIVE authenticated SELECT

-- 1. attendees
CREATE POLICY "Authenticated read own attendee record"
ON public.attendees FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. event_activities (has event_id)
CREATE POLICY "Authenticated read event activities"
ON public.event_activities FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

-- 3. activity_quizzes (join through event_activities)
CREATE POLICY "Authenticated read event quizzes"
ON public.activity_quizzes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM event_activities act
  JOIN attendees a ON a.event_id = act.event_id
  WHERE act.id = activity_quizzes.activity_id
  AND a.user_id = auth.uid()
));

-- 4. attendee_checkins (join through attendees)
CREATE POLICY "Authenticated read own checkins"
ON public.attendee_checkins FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM attendees
  WHERE attendees.id = attendee_checkins.attendee_id
  AND attendees.user_id = auth.uid()
));

-- 5. attendee_services (join through attendees)
CREATE POLICY "Authenticated read own services"
ON public.attendee_services FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM attendees
  WHERE attendees.id = attendee_services.attendee_id
  AND attendees.user_id = auth.uid()
));

-- 6. service_tickets (join through attendee_services → attendees)
CREATE POLICY "Authenticated read own service tickets"
ON public.service_tickets FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM attendee_services aser
  JOIN attendees a ON aser.attendee_id = a.id
  WHERE aser.id = service_tickets.attendee_service_id
  AND a.user_id = auth.uid()
));

-- 7. event_staff (has event_id)
CREATE POLICY "Authenticated read event staff"
ON public.event_staff FOR SELECT TO authenticated
USING (event_id IN (
  SELECT event_id FROM attendees WHERE user_id = auth.uid()
));

-- 8. user_roles
CREATE POLICY "Authenticated read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 9. organizations
CREATE POLICY "Authenticated read own organization"
ON public.organizations FOR SELECT TO authenticated
USING (id IN (
  SELECT organization_id FROM profiles WHERE id = auth.uid()
));

-- 10. chat_conversations (participant check)
CREATE POLICY "Authenticated read own conversations"
ON public.chat_conversations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM chat_participants
  WHERE chat_participants.conversation_id = chat_conversations.id
  AND chat_participants.user_id = auth.uid()
));

-- 11. chat_messages (participant check)
CREATE POLICY "Authenticated read conversation messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM chat_participants
  WHERE chat_participants.conversation_id = chat_messages.conversation_id
  AND chat_participants.user_id = auth.uid()
));

-- 12. chat_participants
CREATE POLICY "Authenticated read own participation"
ON public.chat_participants FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 13. chat_attachments (join through messages → participants)
CREATE POLICY "Authenticated read accessible attachments"
ON public.chat_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM chat_messages cm
  JOIN chat_participants cp ON cm.conversation_id = cp.conversation_id
  WHERE cm.id = chat_attachments.message_id
  AND cp.user_id = auth.uid()
));

-- 14. notifications
CREATE POLICY "Authenticated read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
