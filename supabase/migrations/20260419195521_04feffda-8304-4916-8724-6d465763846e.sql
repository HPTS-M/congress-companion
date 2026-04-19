-- ============================================
-- STEP 1: Quiz answers isolated to admin-only table
-- ============================================

CREATE TABLE IF NOT EXISTS public.activity_quiz_answers (
  quiz_id uuid PRIMARY KEY REFERENCES public.activity_quizzes(id) ON DELETE CASCADE,
  correct_answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_quiz_answers ENABLE ROW LEVEL SECURITY;

-- Migrate existing data
INSERT INTO public.activity_quiz_answers (quiz_id, correct_answer)
SELECT id, correct_answer
FROM public.activity_quizzes
WHERE correct_answer IS NOT NULL
ON CONFLICT (quiz_id) DO NOTHING;

-- Block anon completely
CREATE POLICY "block_anon_quiz_answers"
ON public.activity_quiz_answers FOR SELECT TO anon
USING (false);

-- Only admins of org / event staff / superusers can SELECT
CREATE POLICY "Admins read quiz answers"
ON public.activity_quiz_answers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'superuser'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.activity_quizzes q
    JOIN public.event_activities a ON a.id = q.activity_id
    JOIN public.events e ON e.id = a.event_id
    WHERE q.id = activity_quiz_answers.quiz_id
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.activity_quizzes q
    JOIN public.event_activities a ON a.id = q.activity_id
    WHERE q.id = activity_quiz_answers.quiz_id
      AND public.is_event_staff(auth.uid(), a.event_id)
      AND (public.has_role(auth.uid(), 'coordinator'::public.app_role)
           OR public.has_role(auth.uid(), 'field_manager'::public.app_role))
  )
);

-- Same scope can INSERT/UPDATE/DELETE
CREATE POLICY "Admins manage quiz answers"
ON public.activity_quiz_answers FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'superuser'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.activity_quizzes q
    JOIN public.event_activities a ON a.id = q.activity_id
    JOIN public.events e ON e.id = a.event_id
    WHERE q.id = activity_quiz_answers.quiz_id
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.activity_quizzes q
    JOIN public.event_activities a ON a.id = q.activity_id
    WHERE q.id = activity_quiz_answers.quiz_id
      AND public.is_event_staff(auth.uid(), a.event_id)
      AND (public.has_role(auth.uid(), 'coordinator'::public.app_role)
           OR public.has_role(auth.uid(), 'field_manager'::public.app_role))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'superuser'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.activity_quizzes q
    JOIN public.event_activities a ON a.id = q.activity_id
    JOIN public.events e ON e.id = a.event_id
    WHERE q.id = activity_quiz_answers.quiz_id
      AND e.organization_id = public.get_user_organization(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.activity_quizzes q
    JOIN public.event_activities a ON a.id = q.activity_id
    WHERE q.id = activity_quiz_answers.quiz_id
      AND public.is_event_staff(auth.uid(), a.event_id)
      AND (public.has_role(auth.uid(), 'coordinator'::public.app_role)
           OR public.has_role(auth.uid(), 'field_manager'::public.app_role))
  )
);

CREATE TRIGGER trg_quiz_answers_updated_at
BEFORE UPDATE ON public.activity_quiz_answers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Update process_checkin to read from new table
CREATE OR REPLACE FUNCTION public.process_checkin(_activity_id uuid, _attendee_id uuid, _quiz_responses jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  quiz_questions RECORD;
  total_questions INTEGER;
  correct_answers INTEGER := 0;
  quiz_score DECIMAL(5,2);
  response JSONB;
  question_correct BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT registration_status INTO v_status
  FROM public.attendees
  WHERE id = _attendee_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ATTENDEE_NOT_FOUND',
      'message', 'Asistente no encontrado');
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ATTENDEE_DEACTIVATED',
      'message', 'Este asistente está desactivado y no puede registrar asistencia');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendee_checkins
    WHERE activity_id = _activity_id AND attendee_id = _attendee_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CHECKED_IN',
      'message', 'Ya registraste tu asistencia a esta actividad');
  END IF;

  SELECT COUNT(*) INTO total_questions
  FROM public.activity_quizzes
  WHERE activity_id = _activity_id;

  IF total_questions > 0 THEN
    FOR quiz_questions IN
      SELECT q.id, ans.correct_answer
      FROM public.activity_quizzes q
      LEFT JOIN public.activity_quiz_answers ans ON ans.quiz_id = q.id
      WHERE q.activity_id = _activity_id
    LOOP
      response := _quiz_responses->quiz_questions.id::TEXT;
      IF response IS NOT NULL AND quiz_questions.correct_answer IS NOT NULL THEN
        question_correct := (response->>'answer')::TEXT = quiz_questions.correct_answer;
        IF question_correct THEN
          correct_answers := correct_answers + 1;
        END IF;
      END IF;
    END LOOP;
    quiz_score := (correct_answers::DECIMAL / total_questions::DECIMAL) * 100;
  ELSE
    quiz_score := 100;
  END IF;

  INSERT INTO public.attendee_checkins (
    activity_id, attendee_id, quiz_responses, quiz_score, certificate_generated
  ) VALUES (
    _activity_id, _attendee_id, _quiz_responses, quiz_score, false
  );

  RETURN jsonb_build_object('success', true, 'quiz_score', quiz_score,
    'correct_answers', correct_answers, 'total_questions', total_questions,
    'message', 'Check-in registrado exitosamente');
END;
$function$;

-- Drop the exposed column
ALTER TABLE public.activity_quizzes DROP COLUMN IF EXISTS correct_answer;

-- ============================================
-- STEP 3: Storage event-sponsors scoped by event membership
-- ============================================

DROP POLICY IF EXISTS "Authenticated can view sponsor assets" ON storage.objects;

CREATE POLICY "Authenticated read own event sponsor assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-sponsors' AND (
    public.has_role(auth.uid(), 'superuser'::public.app_role)
    OR ((storage.foldername(name))[1])::uuid IN (SELECT public.get_my_event_ids())
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.organization_id = public.get_user_organization(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND public.is_event_staff(auth.uid(), e.id)
    )
  )
);

-- ============================================
-- STEP 2: Realtime authorization (realtime.messages RLS)
-- Supabase Realtime authorization pattern: policies on realtime.messages
-- gate which topics an authenticated user can subscribe to.
-- Topics in this app:
--   conv-list-{eventId}-{attendeeId}   → eventId
--   dm-{conversationId}                → conversationId
--   checkins-{activityId}              → activityId → event_id
--   active-polls-{eventId}             → eventId
--   poll-{pollId}                      → pollId → event_id
--   agenda-sync-{eventId}              → eventId
-- ============================================

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated realtime scoped by membership" ON realtime.messages;

CREATE POLICY "Authenticated realtime scoped by membership"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Superuser can subscribe to anything
  public.has_role(auth.uid(), 'superuser'::public.app_role)
  -- Topic contains an event_id the user attends
  OR EXISTS (
    SELECT 1 FROM public.attendees a
    WHERE a.user_id = auth.uid()
      AND a.deleted_at IS NULL
      AND realtime.topic() LIKE '%' || a.event_id::text || '%'
  )
  -- Topic contains an event_id of user's org or staff assignment
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE realtime.topic() LIKE '%' || e.id::text || '%'
      AND (e.organization_id = public.get_user_organization(auth.uid())
           OR public.is_event_staff(auth.uid(), e.id))
  )
  -- Topic contains a conversation_id where user participates
  OR EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.user_id = auth.uid()
      AND realtime.topic() LIKE '%' || cp.conversation_id::text || '%'
  )
  -- Topic contains a poll_id whose event the user attends/staffs
  OR EXISTS (
    SELECT 1 FROM public.polls p
    WHERE realtime.topic() LIKE '%' || p.id::text || '%'
      AND (
        p.event_id IN (SELECT public.get_my_event_ids())
        OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = p.event_id
                   AND (e.organization_id = public.get_user_organization(auth.uid())
                        OR public.is_event_staff(auth.uid(), e.id)))
      )
  )
  -- Topic contains an activity_id whose event the user attends/staffs
  OR EXISTS (
    SELECT 1 FROM public.event_activities act
    WHERE realtime.topic() LIKE '%' || act.id::text || '%'
      AND (
        act.event_id IN (SELECT public.get_my_event_ids())
        OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = act.event_id
                   AND (e.organization_id = public.get_user_organization(auth.uid())
                        OR public.is_event_staff(auth.uid(), e.id)))
      )
  )
);