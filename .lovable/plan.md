
Plan: Limpieza total de attendees en evento ACQFH-2026 + datos relacionados.

## Resumen
Borrar TODOS los 573 asistentes del evento `ACQFH-2026` y datos relacionados, dejando la tabla limpia para volver a probar carga masiva desde cero.

## Migración SQL (en orden)

```sql
-- 1. Identificar event_id objetivo y attendees a borrar
WITH target_attendees AS (
  SELECT a.id, a.user_id
  FROM attendees a
  JOIN events e ON e.id = a.event_id
  WHERE e.event_code = 'ACQFH-2026'
)

-- 2. Borrar dependencias (orden importa por FK lógicas)
DELETE FROM service_tickets st
USING attendee_services aser
WHERE st.attendee_service_id = aser.id
  AND aser.attendee_id IN (SELECT id FROM target_attendees);

DELETE FROM attendee_services WHERE attendee_id IN (...);
DELETE FROM attendee_checkins WHERE attendee_id IN (...);
DELETE FROM attendee_notes WHERE user_id IN (...);
DELETE FROM poll_responses WHERE attendee_id IN (...);
DELETE FROM contacts WHERE user_id IN (...) OR contact_id IN (...);
DELETE FROM chat_messages WHERE sender_id IN (...);
DELETE FROM chat_participants WHERE user_id IN (SELECT user_id FROM target_attendees WHERE user_id IS NOT NULL);
DELETE FROM sponsor_leads WHERE attendee_id IN (...);

-- 3. Hard-delete final de attendees
DELETE FROM attendees WHERE id IN (SELECT id FROM target_attendees);
```

## Auth users
Los attendees con `user_id IS NOT NULL` (ya hicieron login) tienen cuenta en `auth.users`. **NO se borrarán automáticamente** desde SQL (el schema `auth` está reservado). Quedarán huérfanas pero inofensivas. Si deseas, puedes borrarlas después manualmente desde el dashboard de Supabase Auth.

## Validación post-borrado
Verificar `SELECT COUNT(*) FROM attendees WHERE event_id = (SELECT id FROM events WHERE event_code = 'ACQFH-2026')` → debe retornar 0.

## Ejecución
Crear migración SQL única, ejecutarla y luego refrescar caches del cliente (TanStack Query) navegando al módulo de asistentes admin.

