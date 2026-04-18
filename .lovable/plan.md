

## Plan: Mostrar nombres reales en chat y contactos

### Problema
`messagingService` y los componentes de contactos consultan directamente la tabla `attendees` para resolver nombres. La RLS solo permite ver el propio registro o contactos aceptados, así que para invitaciones pendientes / mensajes recibidos, el `full_name` viene vacío → la UI muestra el fallback **"Asistente"**.

La vista `public_attendee_directory` (que ya arreglamos) SÍ devuelve a todos los confirmados del evento sin exponer PII. Hay que usarla como fuente de nombres.

### Cambios

**1. `src/services/messaging.service.ts`**
- `getAttendeeNames(eventId)`: cambiar `from('attendees')` → `from('public_attendee_directory')` (mantiene `id` + `full_name`).
- En `getDirectConversations`, la consulta para resolver nombres de la otra persona (líneas 93-101): igual cambio a `public_attendee_directory`.

**2. `src/services/contacts.service.ts`**
- `getAttendeeById()`: ya intenta primero `attendees` (con PII) y cae a `public_attendee_directory`. Funciona — no requiere cambios.
- Verificar que la lookup de nombres en pendientes use el directorio (revisar `Contacts.tsx`).

**3. `src/pages/attendee/Contacts.tsx`**
- Si está resolviendo nombres de solicitudes pendientes vía `attendees` directamente, redirigir a `useEventAttendees` (que ya usa la vista pública) o a un map derivado.

### Resultado esperado
- Daniel verá los nombres reales de quienes le envían invitaciones de chat o solicitudes de contacto.
- Las conversaciones activas y pendientes mostrarán "Carlos Restrepo", "Ana Martínez", etc., en lugar de "Asistente".
- PII (email/teléfono) sigue oculta hasta aceptar conexión mutua.

### Nota técnica
La vista `public_attendee_directory` está marcada como SECURITY DEFINER (lo cual genera el warning del scanner que ves en la pantalla de Security). Es intencional y seguro: la vista solo expone columnas no sensibles y filtra por `event_id IN (get_my_event_ids())`. Marcaremos ese finding como resuelto/ignorado con justificación tras el fix.

