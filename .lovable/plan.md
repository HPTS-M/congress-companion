

## Análisis de los 3 hallazgos

### 1. `activity_quizzes.correct_answer` expuesto a asistentes
Las políticas SELECT actuales (`Attendees can view quizzes`, `Authenticated read event quizzes`) devuelven la fila completa, incluyendo `correct_answer`. Cualquier asistente puede leer las respuestas correctas antes de responder.

**Validación funcional:** revisé `process_checkin` (RPC `SECURITY DEFINER`) — ya valida respuestas server-side comparando contra `correct_answer` directamente desde la tabla. El frontend NO necesita esa columna para funcionar. Solo necesita: `id`, `activity_id`, `question_text`, `question_type`, `options`, `display_order`.

**Solución (recomendada por Lovable docs):** mover `correct_answer` a tabla aparte `activity_quiz_answers` con RLS estricta (solo admins/staff/superuser leen, nunca attendees). `process_checkin` se actualiza para hacer JOIN.

### 2. `realtime.messages` sin RLS
Realtime publica cambios de tablas sensibles (`attendees`, `chat_messages`, `notifications`, `poll_responses`, `announcements`, etc.) sin filtrar por suscriptor. Cualquier usuario autenticado podría suscribirse a topics arbitrarios.

**Solución:** habilitar RLS en `realtime.messages` y agregar política que valide que el `topic` del canal coincide con un `event_id` del que el usuario es asistente/staff/admin. Patrón estándar Supabase.

⚠️ **Riesgo controlado:** los canales actuales del proyecto usan nombres como `chat:{conversation_id}`, `polls:{event_id}`, `announcements:{event_id}`. Hay que confirmar el formato exacto antes de escribir el `USING`. Voy a escanear el código para listarlos.

### 3. `event-sponsors` storage sin filtro por evento
La policy actual solo chequea `bucket_id = 'event-sponsors'`. Cualquier autenticado de cualquier evento ve assets de cualquier otro. Path real: `{event_id}/...` (verificado en `admin-sponsors.service.ts` → `uploadFile` usa `${eventId}/${prefix}-...`).

**Solución:** replicar el patrón de `event-documents`: validar que `(storage.foldername(name))[1]::uuid IN (SELECT get_my_event_ids())` o que el usuario es admin/staff de esa org/evento.

---

## Plan de implementación

### Paso 1 · Migración BD — Quiz answers aislados
```sql
-- Nueva tabla con RLS restrictiva
CREATE TABLE public.activity_quiz_answers (
  quiz_id uuid PRIMARY KEY REFERENCES public.activity_quizzes(id) ON DELETE CASCADE,
  correct_answer text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.activity_quiz_answers ENABLE ROW LEVEL SECURITY;

-- Migrar datos existentes
INSERT INTO public.activity_quiz_answers (quiz_id, correct_answer)
SELECT id, correct_answer FROM public.activity_quizzes
WHERE correct_answer IS NOT NULL;

-- Políticas: bloqueo total para anon + attendee, admin/staff/superuser sí
CREATE POLICY "block_anon_quiz_answers" ON public.activity_quiz_answers
  FOR SELECT TO anon USING (false);
CREATE POLICY "block_attendees_quiz_answers" ON public.activity_quiz_answers
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'superuser') OR
    EXISTS (SELECT 1 FROM activity_quizzes q
            JOIN event_activities a ON a.id = q.activity_id
            JOIN events e ON e.id = a.event_id
            WHERE q.id = quiz_id AND e.organization_id = get_user_organization(auth.uid()))
    OR (has_role(auth.uid(),'coordinator') OR has_role(auth.uid(),'field_manager'))
       AND EXISTS (SELECT 1 FROM activity_quizzes q
                   JOIN event_activities a ON a.id = q.activity_id
                   WHERE q.id = quiz_id AND is_event_staff(auth.uid(), a.event_id))
  );
CREATE POLICY "admins_manage_quiz_answers" ON public.activity_quiz_answers
  FOR ALL TO authenticated USING (/* misma condición admin/staff/superuser */);

-- Actualizar process_checkin para hacer JOIN con la nueva tabla
-- (reemplazar `quiz_questions.correct_answer` por la tabla de answers)

-- Eliminar la columna del esquema público expuesto:
ALTER TABLE public.activity_quizzes DROP COLUMN correct_answer;
```

### Paso 2 · Migración BD — Realtime authorization
```sql
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Política: el topic debe contener un event_id del usuario, o ser una conversation_id
-- donde participa, o un attendee_id propio
CREATE POLICY "Authenticated realtime scoped by membership"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Topics que llevan event_id (announcements, polls, agenda)
  EXISTS (
    SELECT 1 FROM public.attendees a
    WHERE a.user_id = auth.uid()
      AND a.deleted_at IS NULL
      AND topic LIKE '%' || a.event_id::text || '%'
  )
  OR EXISTS ( -- staff/admin de la org del evento mencionado en topic
    SELECT 1 FROM public.events e
    WHERE topic LIKE '%' || e.id::text || '%'
      AND (e.organization_id = get_user_organization(auth.uid())
           OR is_event_staff(auth.uid(), e.id)
           OR has_role(auth.uid(),'superuser'))
  )
  OR EXISTS ( -- conversaciones de chat donde el user participa
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.user_id = auth.uid() AND topic LIKE '%' || cp.conversation_id::text || '%'
  )
);
```
Antes de aplicar, en Paso 0 voy a `grep` todos los `supabase.channel('...')` del repo para confirmar formato exacto de topics.

### Paso 3 · Migración BD — Storage event-sponsors aislado por evento
```sql
DROP POLICY IF EXISTS "Authenticated can view sponsor assets" ON storage.objects;

CREATE POLICY "Authenticated read own event sponsor assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-sponsors' AND (
    -- Asistente del evento
    ((storage.foldername(name))[1])::uuid IN (SELECT get_my_event_ids())
    -- o admin de la org dueña del evento
    OR EXISTS (SELECT 1 FROM events e
               WHERE e.id::text = (storage.foldername(name))[1]
                 AND e.organization_id = get_user_organization(auth.uid()))
    -- o staff
    OR EXISTS (SELECT 1 FROM events e
               WHERE e.id::text = (storage.foldername(name))[1]
                 AND is_event_staff(auth.uid(), e.id))
    OR has_role(auth.uid(),'superuser')
  )
);
```

### Paso 4 · Cambios de código
- `src/services/admin-agenda.service.ts` (o donde se cree quizzes): al INSERT/UPDATE de quizzes, hacer también upsert en `activity_quiz_answers`. Verificar dónde se gestiona hoy.
- `src/services/checkin.service.ts` y consumidores: si alguno lee `correct_answer` desde el cliente, refactorizar para depender solo de `process_checkin` (ya server-side).
- Regenerar tipos Supabase (automático).

### Paso 5 · Verificación
1. `supabase--linter` debe quedar limpio en estos 3 hallazgos.
2. Test: como attendee, `select correct_answer from activity_quizzes` → debe fallar (columna no existe).
3. Test: como attendee, `select * from activity_quiz_answers` → 0 filas.
4. Test: `process_checkin` sigue calculando score correctamente.
5. Test realtime: usuario evento A no recibe broadcasts del evento B (chat, polls, announcements).
6. Test storage: signed URL del bucket sponsors solo se genera si user pertenece al evento.

### Orden de ejecución
1. Grep de topics realtime (read-only) para confirmar patrón
2. Migración 1 (quiz answers) + actualizar `process_checkin` + admin services
3. Migración 2 (realtime RLS) — con cuidado, probar suscripciones después
4. Migración 3 (storage sponsors)
5. Re-correr security scan

