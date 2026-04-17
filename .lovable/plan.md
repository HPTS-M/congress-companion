

## Plan: Restaurar visibilidad de participantes en Networking

### Causa raíz
La migración de seguridad del 17-abr eliminó la política `Attendees view event directory` y la sustituyó por una más restrictiva (`Attendees view accepted contacts`) que solo deja ver asistentes con contacto aceptado. La vista `public_attendee_directory` está marcada con `security_invoker = true`, por lo que hereda esa restricción → devuelve 0 filas para todos.

Resultado: el módulo **Networking → Participantes** muestra "No se encontraron participantes" aunque haya 19 asistentes confirmados.

### Solución
Cambiar la vista `public_attendee_directory` a `security_invoker = false`. La vista ya filtra internamente:
- `deleted_at IS NULL`
- `registration_status = 'confirmed'`
- `event_id IN (SELECT get_my_event_ids())` ← garantiza aislamiento por evento

Y solo expone columnas seguras (id, full_name, specialty, institution, registration_status). **No expone email/teléfono/documento/credencial**, así que la PII sigue protegida.

La política `Attendees view accepted contacts` se mantiene intacta para la tabla base `attendees` — para ver datos completos (email, etc.) seguirá requiriéndose conexión mutua.

### Cambios

**1. Migración SQL nueva**
```sql
DROP VIEW IF EXISTS public.public_attendee_directory;

CREATE VIEW public.public_attendee_directory
WITH (security_invoker = false) AS
SELECT
  a.id, a.event_id, a.full_name,
  a.specialty, a.institution, a.registration_status
FROM public.attendees a
WHERE a.deleted_at IS NULL
  AND a.registration_status = 'confirmed'
  AND a.event_id IN (SELECT public.get_my_event_ids());

GRANT SELECT ON public.public_attendee_directory TO authenticated;
```

**2. Memoria a actualizar**
- `mem://security/attendee-directory-access`: aclarar que el directorio público se sirve vía vista SECURITY DEFINER con columnas no sensibles, mientras que la tabla `attendees` solo expone PII completa a contactos aceptados.

### Comportamiento esperado
- Daniel Sanchez verá los otros 18 participantes confirmados del ACQFH-2026 en la pestaña "Participantes".
- Búsqueda por nombre/especialidad/institución funcional.
- Botón "Conectar" disponible para enviar solicitudes.
- Email/teléfono siguen ocultos hasta que la conexión sea mutuamente aceptada (sin regresión de seguridad).

