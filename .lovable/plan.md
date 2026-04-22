

## Plan — Borrado total de datos de asistentes para ACQFH-2026

### Objetivo

Eliminar **todos los datos relacionados con asistentes** del congreso XIII Congreso Nacional de Farmacia Hospitalaria (event_code: `ACQFH-2026`, id: `5efca36a-deef-489b-be85-3dc9d1501ed7`) dejando intacto el resto de la configuración del evento (agenda, sponsors, servicios del catálogo, polls, documentos, staff, providers, organización).

### Alcance — qué SÍ se borra

Datos generados por o asociados a asistentes:

| Tabla | Filtro |
|---|---|
| `attendees` | `event_id = ACQFH` |
| `attendee_services` | asistentes del evento |
| `service_tickets` | tickets de esos `attendee_services` |
| `attendee_checkins` | check-ins de esos asistentes |
| `attendee_notes` | notas de usuarios asistentes en este evento |
| `contacts` | `event_id = ACQFH` |
| `session_interests` | `event_id = ACQFH` |
| `ratings` | `event_id = ACQFH` |
| `poll_responses` | respuestas de asistentes del evento |
| `sponsor_leads` | `event_id = ACQFH` |
| `invitation_send_log` | logs de invitaciones de esos asistentes |
| `attendee_announcement_views` | `event_id = ACQFH` |
| `attendee_message_views` | `event_id = ACQFH` |
| `chat_messages` | mensajes de conversaciones del evento |
| `chat_participants` | participaciones en conversaciones del evento |
| `chat_attachments` | adjuntos de mensajes borrados |
| `chat_conversations` | `event_id = ACQFH` |
| `push_subscriptions` | `event_id = ACQFH` |
| `notifications` | `event_id = ACQFH` |
| `access_attempts` | `event_code = 'ACQFH-2026'` |

Adicionalmente, eliminar los **usuarios de Supabase Auth (`auth.users`)** vinculados a los asistentes borrados, vía `supabase.auth.admin.deleteUser()` desde una Edge Function (no se puede hacer desde SQL directo). Esto libera los emails/credenciales para futuras importaciones limpias.

### Alcance — qué NO se toca

- `events` — el evento sigue existiendo, solo se vacía de asistentes.
- `event_packages`, `event_activities` (agenda), `service_catalog` — la configuración del evento permanece.
- `sponsors`, `providers`, `provider_services`, `staff_members`, `event_staff` — actores del evento intactos.
- `polls`, `poll_options` — preguntas se mantienen, solo se borran las respuestas.
- `documents`, `announcements` — contenido editorial intacto.
- `organizations`, `profiles` (admins/staff/providers), `user_roles` (admins) — usuarios administrativos intactos.
- `auth.users` de admins/staff/providers — solo se borran los de attendees confirmados.

### Estrategia de ejecución

Como esto es un borrado masivo y destructivo en un evento real, se ejecutará con respaldo de seguridad y orden estricto:

#### Paso 1 — Snapshot de seguridad (lectura previa)
Ejecutar conteo total de filas que serán afectadas en cada tabla y mostrarlo en pantalla antes de borrar. Si alguna cifra es inesperada, abortamos.

#### Paso 2 — Edge Function `purge-event-attendees`
Crear una nueva Edge Function porque:
1. Necesitamos `service_role_key` para borrar de `auth.users` (no hay forma desde SQL).
2. Centraliza la lógica en una sola transacción auditada.
3. Permite dry-run vs ejecución real con un parámetro `confirm: true`.
4. Solo invocable por superusers (validación de rol vía JWT).

La función:
1. Valida que el caller tiene rol `superuser`.
2. Recibe `event_id` y `confirm: boolean` en el body.
3. Si `confirm = false` → devuelve solo el conteo de lo que se borraría (dry-run).
4. Si `confirm = true`:
   - Lista `user_id` de todos los attendees del evento (los que no son null).
   - Borra en orden inverso de dependencias usando el `service_role_key`:
     ```
     chat_attachments → chat_messages → chat_participants → chat_conversations
     poll_responses
     sponsor_leads
     ratings
     session_interests
     contacts
     attendee_notes (filtradas por user_id de attendees)
     attendee_checkins
     invitation_send_log
     attendee_announcement_views
     attendee_message_views
     push_subscriptions (event_id)
     notifications (event_id)
     service_tickets → attendee_services
     attendees
     access_attempts (event_code)
     ```
   - Para cada `user_id` recolectado: `supabase.auth.admin.deleteUser(user_id)`.
   - Devuelve resumen con conteos finales.

#### Paso 3 — Botón de UI en panel admin (opcional, recomendado)
Agregar un botón **"Purgar todos los asistentes"** en una sección "Zona Peligrosa" de `EventConfig.tsx`, visible solo para superusers, que:
1. Abre un `AlertDialog` con advertencia roja.
2. Pide escribir el `event_code` exacto (`ACQFH-2026`) para confirmar.
3. Llama primero a `purge-event-attendees` con `confirm: false` → muestra conteo de lo que se borrará.
4. Pide confirmación final → llama con `confirm: true`.
5. Muestra resultado con conteos por tabla y refresca queries de TanStack.

Si prefieres ejecución one-shot sin UI (sólo esta vez), saltamos el Paso 3 y ejecutamos la edge function directamente desde una llamada manual.

### Consideraciones técnicas

- **FKs sin CASCADE**: la mayoría de FKs hacia `attendees` no tienen `ON DELETE CASCADE`, por eso el orden de borrado es crítico. La edge function ejecuta los DELETE en orden correcto desde las hojas hacia la raíz.
- **Triggers**: `cascade_service_cancellation` y `set_service_cancelled_at` solo actúan en UPDATE (no en DELETE), no interfieren.
- **RLS**: la edge function usa `service_role_key` que bypassa RLS, evitando bloqueos por políticas.
- **Idempotencia**: si una corrida falla a mitad, se puede re-ejecutar sin problema (los DELETE ya aplicados quedan, los pendientes se completan).
- **Auth users**: se borran al final porque algunas FKs apuntan a `auth.users(id)` (`profiles`, `chat_messages.sender_id`, etc). Borrar primero los datos de las tablas públicas evita constraint violations.

### Decisión que necesito de ti

Antes de implementar, dime:

1. **¿Solo este evento (ACQFH-2026) o todos los eventos?** Asumo solo ACQFH-2026 según contexto, pero confirma.
2. **¿Quieres el botón en UI (Paso 3) o ejecución one-shot directa?** El botón es más seguro para el futuro pero requiere ~80 líneas extra. Si es purga única, podemos saltarlo.
3. **¿Borrar también los `auth.users` de los asistentes?** Recomiendo SÍ para limpieza total, pero si quieres conservar las cuentas de auth (por si acaso), lo skipeamos.

### Archivos que se crearán/modificarán

| Archivo | Tipo | Líneas |
|---|---|---|
| `supabase/functions/purge-event-attendees/index.ts` | Crear | ~150 |
| `src/pages/admin/EventConfig.tsx` (si Paso 3) | Modificar — añadir Danger Zone | ~80 |
| `src/locales/es/admin.json` y `en/admin.json` (si Paso 3) | Modificar — claves de purga | ~10 |

**Sin migración de schema. Sin cambios en RLS. Operación reversible solo desde backup de Supabase (Point-in-Time Recovery).**

### Verificación post-purga

Edge function devolverá un payload tipo:
```json
{
  "deleted": {
    "attendees": 152,
    "attendee_services": 308,
    "service_tickets": 308,
    "chat_messages": 1240,
    "auth_users": 152,
    ...
  },
  "remaining": {
    "events": 1,
    "agenda_sessions": 24,
    "sponsors": 8,
    "service_catalog": 12
  }
}
```

Esto te permite validar de un vistazo que el evento sigue configurado y que todos los datos de asistentes desaparecieron.

