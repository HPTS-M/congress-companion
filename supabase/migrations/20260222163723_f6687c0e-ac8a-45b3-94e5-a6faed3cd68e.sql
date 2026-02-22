
-- Block anonymous access on ALL tables with sensitive data
-- RLS is already enabled, but we need explicit DENY for anon role

CREATE POLICY "block_anon_access" ON public.attendees FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.profiles FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.service_tickets FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.chat_messages FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.chat_conversations FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.chat_participants FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.chat_attachments FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.organizations FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.events FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.attendee_services FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.user_roles FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.notifications FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.event_packages FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.event_activities FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.activity_quizzes FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.attendee_checkins FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.event_staff FOR SELECT TO anon USING (false);
CREATE POLICY "block_anon_access" ON public.role_audit FOR SELECT TO anon USING (false);
