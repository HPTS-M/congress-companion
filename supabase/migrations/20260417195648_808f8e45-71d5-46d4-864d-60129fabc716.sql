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
  -- Block check-in for cancelled (deactivated) attendees
  SELECT registration_status INTO v_status
  FROM public.attendees
  WHERE id = _attendee_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ATTENDEE_NOT_FOUND',
      'message', 'Asistente no encontrado'
    );
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ATTENDEE_DEACTIVATED',
      'message', 'Este asistente está desactivado y no puede registrar asistencia'
    );
  END IF;

  -- Check if already checked in
  IF EXISTS (
    SELECT 1 FROM public.attendee_checkins
    WHERE activity_id = _activity_id AND attendee_id = _attendee_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CHECKED_IN',
      'message', 'Ya registraste tu asistencia a esta actividad'
    );
  END IF;

  SELECT COUNT(*) INTO total_questions
  FROM public.activity_quizzes
  WHERE activity_id = _activity_id;

  IF total_questions > 0 THEN
    FOR quiz_questions IN
      SELECT id, correct_answer
      FROM public.activity_quizzes
      WHERE activity_id = _activity_id
    LOOP
      response := _quiz_responses->quiz_questions.id::TEXT;
      IF response IS NOT NULL THEN
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

  RETURN jsonb_build_object(
    'success', true,
    'quiz_score', quiz_score,
    'correct_answers', correct_answers,
    'total_questions', total_questions,
    'message', 'Check-in registrado exitosamente'
  );
END;
$function$;