-- =============================================
-- A. RPCs para conteos de notificaciones
-- =============================================

CREATE OR REPLACE FUNCTION public.count_unread_announcements(
  _event_id uuid,
  _last_seen timestamptz
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.announcements
  WHERE event_id = _event_id
    AND _event_id IN (SELECT public.get_my_event_ids())
    AND sent_at IS NOT NULL
    AND sent_at > _last_seen;
$$;

CREATE OR REPLACE FUNCTION public.count_unread_messages(
  _event_id uuid,
  _attendee_id uuid,
  _last_seen timestamptz
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pending_invites', (
      SELECT COUNT(*)::int FROM public.chat_conversations
      WHERE event_id = _event_id
        AND conversation_type = 'direct'
        AND status = 'pending'
        AND participant_id = _attendee_id
        AND COALESCE(deleted_by_participant, false) = false
        AND _attendee_id IN (SELECT public.get_my_attendee_ids())
    ),
    'unread_messages', (
      SELECT COUNT(*)::int FROM public.chat_conversations
      WHERE event_id = _event_id
        AND conversation_type = 'direct'
        AND status = 'active'
        AND (initiated_by = _attendee_id OR participant_id = _attendee_id)
        AND last_message_at IS NOT NULL
        AND last_message_at > _last_seen
        AND _attendee_id IN (SELECT public.get_my_attendee_ids())
    )
  );
$$;

-- =============================================
-- B. RPC: get_my_direct_conversations
-- Devuelve conversaciones directas con el nombre del otro asistente resuelto
-- =============================================

CREATE OR REPLACE FUNCTION public.get_my_direct_conversations(
  _event_id uuid,
  _attendee_id uuid
) RETURNS TABLE (
  id uuid,
  status text,
  initiated_by uuid,
  participant_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz,
  other_id uuid,
  other_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    cc.id,
    cc.status,
    cc.initiated_by,
    cc.participant_id,
    cc.last_message_at,
    cc.last_message_preview,
    cc.created_at,
    CASE WHEN cc.initiated_by = _attendee_id THEN cc.participant_id ELSE cc.initiated_by END AS other_id,
    a.full_name AS other_name
  FROM public.chat_conversations cc
  LEFT JOIN public.attendees a
    ON a.id = CASE WHEN cc.initiated_by = _attendee_id THEN cc.participant_id ELSE cc.initiated_by END
   AND a.deleted_at IS NULL
  WHERE cc.event_id = _event_id
    AND cc.conversation_type = 'direct'
    AND (
      (cc.initiated_by = _attendee_id AND COALESCE(cc.deleted_by_initiator, false) = false)
      OR
      (cc.participant_id = _attendee_id AND COALESCE(cc.deleted_by_participant, false) = false)
    )
    AND _attendee_id IN (SELECT public.get_my_attendee_ids())
  ORDER BY cc.last_message_at DESC NULLS LAST, cc.created_at DESC;
$$;

-- =============================================
-- C. RPC: get_active_polls_with_counts
-- =============================================

CREATE OR REPLACE FUNCTION public.get_active_polls_with_counts(
  _event_id uuid,
  _attendee_id uuid
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(poll_data ORDER BY created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      p.id,
      p.created_at,
      jsonb_build_object(
        'id', p.id,
        'question', p.question,
        'poll_type', p.poll_type,
        'status', p.status,
        'session_id', p.session_id,
        'session', CASE WHEN ea.id IS NOT NULL
          THEN jsonb_build_object('title', ea.title)
          ELSE NULL END,
        'options', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', o.id,
            'option_text', o.option_text,
            'order_index', o.order_index
          ) ORDER BY o.order_index)
          FROM public.poll_options o
          WHERE o.poll_id = p.id AND o.is_active = true
        ), '[]'::jsonb),
        'response_count', (
          SELECT COUNT(*)::int FROM public.poll_responses r WHERE r.poll_id = p.id
        ),
        'my_response', (
          SELECT jsonb_build_object(
            'option_ids', COALESCE(jsonb_agg(r.option_id) FILTER (WHERE r.option_id IS NOT NULL), '[]'::jsonb),
            'text_response', MAX(r.text_response)
          )
          FROM public.poll_responses r
          WHERE r.poll_id = p.id AND r.attendee_id = _attendee_id
          HAVING COUNT(*) > 0
        )
      ) AS poll_data
    FROM public.polls p
    LEFT JOIN public.event_activities ea ON ea.id = p.session_id
    WHERE p.event_id = _event_id
      AND p.status = 'active'
      AND _event_id IN (SELECT public.get_my_event_ids())
  ) sub;
$$;

-- =============================================
-- D. Permisos
-- =============================================

GRANT EXECUTE ON FUNCTION public.count_unread_announcements(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unread_messages(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_direct_conversations(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_polls_with_counts(uuid, uuid) TO authenticated;

-- =============================================
-- E. Índices
-- =============================================

CREATE INDEX IF NOT EXISTS idx_announcements_event_sent_at
  ON public.announcements(event_id, sent_at DESC) WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_status
  ON public.chat_conversations(event_id, participant_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_initiator_status
  ON public.chat_conversations(event_id, initiated_by, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_event_created_at
  ON public.documents(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_attendee
  ON public.poll_responses(poll_id, attendee_id);