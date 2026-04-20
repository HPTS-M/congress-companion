DO $$
DECLARE
  v_event_id uuid;
BEGIN
  SELECT id INTO v_event_id FROM events WHERE event_code = 'ACQFH-2026';

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event ACQFH-2026 not found';
  END IF;

  -- Tickets de servicios
  DELETE FROM service_tickets st
  USING attendee_services aser
  WHERE st.attendee_service_id = aser.id
    AND aser.attendee_id IN (SELECT id FROM attendees WHERE event_id = v_event_id);

  -- Servicios contratados
  DELETE FROM attendee_services
  WHERE attendee_id IN (SELECT id FROM attendees WHERE event_id = v_event_id);

  -- Check-ins
  DELETE FROM attendee_checkins
  WHERE attendee_id IN (SELECT id FROM attendees WHERE event_id = v_event_id);

  -- Notas
  DELETE FROM attendee_notes WHERE event_id = v_event_id;

  -- Respuestas a encuestas
  DELETE FROM poll_responses
  WHERE attendee_id IN (SELECT id FROM attendees WHERE event_id = v_event_id);

  -- Intereses en sesiones
  DELETE FROM session_interests WHERE event_id = v_event_id;

  -- Contactos / networking
  DELETE FROM contacts
  WHERE user_id IN (SELECT id FROM attendees WHERE event_id = v_event_id)
     OR contact_id IN (SELECT id FROM attendees WHERE event_id = v_event_id);

  -- Sponsor leads
  DELETE FROM sponsor_leads WHERE event_id = v_event_id;

  -- Push subscriptions
  DELETE FROM push_subscriptions WHERE event_id = v_event_id;

  -- Ratings
  DELETE FROM ratings WHERE event_id = v_event_id;

  -- Mensajes y conversaciones (solo de attendees del evento)
  DELETE FROM chat_messages
  WHERE sender_id IN (SELECT id FROM attendees WHERE event_id = v_event_id);

  DELETE FROM chat_participants
  WHERE user_id IN (
    SELECT user_id FROM attendees
    WHERE event_id = v_event_id AND user_id IS NOT NULL
  );

  DELETE FROM chat_conversations
  WHERE event_id = v_event_id
    AND NOT EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.conversation_id = chat_conversations.id);

  -- Notificaciones
  DELETE FROM notifications
  WHERE event_id = v_event_id
    AND user_id IN (
      SELECT user_id FROM attendees
      WHERE event_id = v_event_id AND user_id IS NOT NULL
    );

  -- Hard delete final de attendees
  DELETE FROM attendees WHERE event_id = v_event_id;

  RAISE NOTICE 'Limpieza completada para evento ACQFH-2026';
END $$;