-- Índice único parcial: garantiza que no existan dos asistentes activos
-- con el mismo external_credential_code dentro de un mismo evento.
-- - Insensible a mayúsculas y espacios accidentales (lower + trim).
-- - Permite múltiples filas con código NULL o vacío.
-- - Ignora attendees soft-deleted (deleted_at IS NOT NULL).
-- - Mismo código puede repetirse entre eventos distintos (multi-tenant).

CREATE UNIQUE INDEX IF NOT EXISTS attendees_event_external_code_unique
ON public.attendees (event_id, lower(trim(external_credential_code)))
WHERE external_credential_code IS NOT NULL
  AND trim(external_credential_code) <> ''
  AND deleted_at IS NULL;