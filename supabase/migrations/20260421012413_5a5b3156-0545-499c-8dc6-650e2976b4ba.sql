-- ─────────────────────────────────────────────────────────────
-- 1. Tabla: attendee_message_views
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.attendee_message_views (
  attendee_id  uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attendee_id, event_id)
);

ALTER TABLE public.attendee_message_views ENABLE ROW LEVEL SECURITY;

-- LL-002: RESTRICTIVE bloquea anon
CREATE POLICY "block_anon_access"
  ON public.attendee_message_views AS RESTRICTIVE
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Attendee read own message view"
  ON public.attendee_message_views FOR SELECT TO authenticated
  USING (attendee_id IN (SELECT public.get_my_attendee_ids()));

CREATE POLICY "Attendee insert own message view"
  ON public.attendee_message_views FOR INSERT TO authenticated
  WITH CHECK (attendee_id IN (SELECT public.get_my_attendee_ids()));

CREATE POLICY "Attendee update own message view"
  ON public.attendee_message_views FOR UPDATE TO authenticated
  USING (attendee_id IN (SELECT public.get_my_attendee_ids()))
  WITH CHECK (attendee_id IN (SELECT public.get_my_attendee_ids()));

GRANT SELECT, INSERT, UPDATE ON public.attendee_message_views TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla: attendee_announcement_views
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.attendee_announcement_views (
  attendee_id  uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attendee_id, event_id)
);

ALTER TABLE public.attendee_announcement_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_access"
  ON public.attendee_announcement_views AS RESTRICTIVE
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Attendee read own announcement view"
  ON public.attendee_announcement_views FOR SELECT TO authenticated
  USING (attendee_id IN (SELECT public.get_my_attendee_ids()));

CREATE POLICY "Attendee insert own announcement view"
  ON public.attendee_announcement_views FOR INSERT TO authenticated
  WITH CHECK (attendee_id IN (SELECT public.get_my_attendee_ids()));

CREATE POLICY "Attendee update own announcement view"
  ON public.attendee_announcement_views FOR UPDATE TO authenticated
  USING (attendee_id IN (SELECT public.get_my_attendee_ids()))
  WITH CHECK (attendee_id IN (SELECT public.get_my_attendee_ids()));

GRANT SELECT, INSERT, UPDATE ON public.attendee_announcement_views TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. RPC: mark_messages_seen
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_messages_seen(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attendee_id uuid;
BEGIN
  SELECT id INTO _attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _attendee_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.attendee_message_views (attendee_id, event_id, last_seen_at)
  VALUES (_attendee_id, _event_id, now())
  ON CONFLICT (attendee_id, event_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC: seed_messages_seen (one-time localStorage migration)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_messages_seen(_event_id uuid, _last_seen timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attendee_id uuid;
BEGIN
  SELECT id INTO _attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _attendee_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.attendee_message_views (attendee_id, event_id, last_seen_at)
  VALUES (_attendee_id, _event_id, _last_seen)
  ON CONFLICT (attendee_id, event_id) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC: count_unread_messages — new signature (event_id only)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.count_unread_messages(uuid, uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.count_unread_messages(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attendee_id uuid;
  _last_seen   timestamptz;
BEGIN
  SELECT id INTO _attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _attendee_id IS NULL THEN
    RETURN jsonb_build_object('pending_invites', 0, 'unread_messages', 0);
  END IF;

  SELECT COALESCE(last_seen_at, 'epoch'::timestamptz) INTO _last_seen
  FROM public.attendee_message_views
  WHERE attendee_id = _attendee_id AND event_id = _event_id;

  IF _last_seen IS NULL THEN
    _last_seen := 'epoch'::timestamptz;
  END IF;

  RETURN jsonb_build_object(
    'pending_invites', (
      SELECT COUNT(*)::int FROM public.chat_conversations
      WHERE event_id = _event_id
        AND conversation_type = 'direct'
        AND status = 'pending'
        AND participant_id = _attendee_id
        AND COALESCE(deleted_by_participant, false) = false
    ),
    'unread_messages', (
      SELECT COUNT(*)::int FROM public.chat_conversations
      WHERE event_id = _event_id
        AND conversation_type = 'direct'
        AND status = 'active'
        AND (initiated_by = _attendee_id OR participant_id = _attendee_id)
        AND last_message_at IS NOT NULL
        AND last_message_at > _last_seen
    )
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC: mark_announcements_seen
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_announcements_seen(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attendee_id uuid;
BEGIN
  SELECT id INTO _attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _attendee_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.attendee_announcement_views (attendee_id, event_id, last_seen_at)
  VALUES (_attendee_id, _event_id, now())
  ON CONFLICT (attendee_id, event_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: seed_announcements_seen (one-time localStorage migration)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_announcements_seen(_event_id uuid, _last_seen timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attendee_id uuid;
BEGIN
  SELECT id INTO _attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _attendee_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.attendee_announcement_views (attendee_id, event_id, last_seen_at)
  VALUES (_attendee_id, _event_id, _last_seen)
  ON CONFLICT (attendee_id, event_id) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. RPC: count_unread_announcements — new signature (event_id only)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.count_unread_announcements(uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.count_unread_announcements(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attendee_id uuid;
  _last_seen   timestamptz;
BEGIN
  SELECT id INTO _attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _attendee_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT last_seen_at INTO _last_seen
  FROM public.attendee_announcement_views
  WHERE attendee_id = _attendee_id AND event_id = _event_id;

  IF _last_seen IS NULL THEN
    _last_seen := 'epoch'::timestamptz;
  END IF;

  RETURN (
    SELECT COUNT(*)::int FROM public.announcements
    WHERE event_id = _event_id
      AND sent_at IS NOT NULL
      AND sent_at > _last_seen
  );
END;
$$;