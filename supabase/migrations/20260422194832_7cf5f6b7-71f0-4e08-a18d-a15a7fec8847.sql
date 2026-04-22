-- Purge all attendee data for event ACQFH-2026 (id: 5efca36a-deef-489b-be85-3dc9d1501ed7)
-- Preserves event configuration: agenda, sponsors, service_catalog, polls, documents, staff, providers
DO $$
DECLARE
  v_event_id uuid := '5efca36a-deef-489b-be85-3dc9d1501ed7';
  v_event_code text := 'ACQFH-2026';
  v_attendee_ids uuid[];
  v_conversation_ids uuid[];
  v_message_ids uuid[];
  v_attendee_service_ids uuid[];
BEGIN
  -- Collect IDs upfront
  SELECT array_agg(id) INTO v_attendee_ids FROM attendees WHERE event_id = v_event_id;
  SELECT array_agg(id) INTO v_conversation_ids FROM chat_conversations WHERE event_id = v_event_id;
  SELECT array_agg(id) INTO v_message_ids FROM chat_messages WHERE conversation_id = ANY(COALESCE(v_conversation_ids, ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_attendee_service_ids FROM attendee_services WHERE attendee_id = ANY(COALESCE(v_attendee_ids, ARRAY[]::uuid[]));

  -- Chat tree (leaves first)
  DELETE FROM chat_attachments WHERE message_id = ANY(COALESCE(v_message_ids, ARRAY[]::uuid[]));
  DELETE FROM chat_messages WHERE conversation_id = ANY(COALESCE(v_conversation_ids, ARRAY[]::uuid[]));
  DELETE FROM chat_participants WHERE conversation_id = ANY(COALESCE(v_conversation_ids, ARRAY[]::uuid[]));
  DELETE FROM chat_conversations WHERE event_id = v_event_id;

  -- Attendee-related data
  DELETE FROM poll_responses WHERE attendee_id = ANY(COALESCE(v_attendee_ids, ARRAY[]::uuid[]));
  DELETE FROM sponsor_leads WHERE event_id = v_event_id;
  DELETE FROM ratings WHERE event_id = v_event_id;
  DELETE FROM session_interests WHERE event_id = v_event_id;
  DELETE FROM contacts WHERE event_id = v_event_id;
  DELETE FROM attendee_notes WHERE event_id = v_event_id;
  DELETE FROM attendee_checkins WHERE attendee_id = ANY(COALESCE(v_attendee_ids, ARRAY[]::uuid[]));
  DELETE FROM invitation_send_log WHERE event_id = v_event_id;
  DELETE FROM attendee_announcement_views WHERE event_id = v_event_id;
  DELETE FROM attendee_message_views WHERE event_id = v_event_id;
  DELETE FROM push_subscriptions WHERE event_id = v_event_id;
  DELETE FROM notifications WHERE event_id = v_event_id;

  -- Service tickets and attendee_services
  DELETE FROM service_tickets WHERE attendee_service_id = ANY(COALESCE(v_attendee_service_ids, ARRAY[]::uuid[]));
  DELETE FROM attendee_services WHERE attendee_id = ANY(COALESCE(v_attendee_ids, ARRAY[]::uuid[]));

  -- Final: attendees + access attempts
  DELETE FROM attendees WHERE event_id = v_event_id;
  DELETE FROM access_attempts WHERE event_code = v_event_code;

  RAISE NOTICE 'Purge complete for event %', v_event_code;
END $$;