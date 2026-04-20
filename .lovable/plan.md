

## Plan: Corregir rutas duplicadas y consistencia en envío de credenciales

### Diagnóstico

**Problema 1 — Rutas duplicadas tipo `/ACQFH-2026/ACQFH-2026`**

El helper `buildEventUrl` en `supabase/functions/_shared/build-event-url.ts` ya intenta defenderse de un `APP_URL` mal configurado, pero tiene **dos limitaciones**:

1. Solo elimina **una** ocurrencia trailing del `event_code` (`/ACQFH-2026$`). Si el secret quedó como `https://congress-connect-app.lovable.app/ACQFH-2026/`, primero se quita la barra y luego SÍ se quita el código → OK. Pero si quedó `…lovable.app/ACQFH-2026/ACQFH-2026` (caso reportado), solo limpia el último y devuelve `…lovable.app/ACQFH-2026/ACQFH-2026` de nuevo (duplicado).
2. **Otras dos edge functions construyen URLs sin usar este helper**:
   - `create-staff-user`: `${appUrl}/${event_code}/staff` — si `APP_URL` ya tiene un slug, queda duplicado.
   - `create-provider-user`: `${appUrl}/provider` — mismo riesgo.

Las únicas funciones que SÍ usan el helper son `send-invitation-email` y `regenerate-access-code`.

**Problema 2 — Algunos asistentes no reciben el correo**

Revisando `send-invitation-email`:
- ✅ Hay reintentos con backoff (500/1500/4000 ms) para 429 y 5xx.
- ✅ Hay clasificación de errores (rate_limited, invalid_recipient, db_error, resend_error).
- ✅ Se procesan en chunks de 20 con `Promise.allSettled`.
- ⚠️ **Pero los fallos solo se registran en `console.log`** — no hay tabla de auditoría. Si Resend devuelve un fallo permanente (invalid_recipient, dominio bloqueado), el frontend solo ve un contador `failed: N` y un array `errors[]`, pero **el usuario admin no tiene forma de revisar después qué pasó**.
- ⚠️ El campo `invitation_sent_at` se actualiza **antes** de enviar el correo (línea 156). Esto es correcto para que la credencial sea válida, pero **pinta como "enviado" incluso a quien nunca recibió el email**. El admin ve el badge "Invitado" en la UI y asume que llegó.
- ⚠️ No hay forma de **reintentar solo los fallidos** desde la UI de admin — hay que volver a seleccionarlos manualmente, y el sistema los considera "ya invitados".

**Causa raíz combinada**: Falta una **bitácora persistente** de envíos (éxito/fallo + razón) y un mecanismo de **reintento dirigido** a los que fallaron.

### Decisión

Tres cambios quirúrgicos:

**A. URL robusto** — endurecer `buildEventUrl` para limpiar **cualquier número** de duplicaciones del `event_code` y usarlo en TODAS las edge functions que generan URLs.

**B. Bitácora de envíos** — crear tabla `invitation_send_log` que registre cada intento (timestamp, attendee_id, status, reason, retries). El admin puede consultarla desde el modal de envío.

**C. Reintento dirigido** — agregar acción "Reenviar fallidos" en el modal `BulkSendCredentialsModal` que filtra por `invitation_send_log.status = 'failed'` (o sin registro alguno) y dispara solo esos.

### Cambios concretos

#### A. URLs (no requiere migración)

**`supabase/functions/_shared/build-event-url.ts`** — endurecer:
- Reemplazar el regex `replace` por un loop `while` que quite TODAS las ocurrencias trailing de `/${eventCode}` (case-insensitive), no solo una.
- Mismo tratamiento para trailing slashes intermedias.
- Resultado: aunque `APP_URL` quede como `…lovable.app/ACQFH-2026/ACQFH-2026/`, devuelve `…lovable.app/ACQFH-2026`.

**`supabase/functions/create-staff-user/index.ts`**
- Importar `buildEventUrl` y reemplazar la línea 113 `\`${appUrl}/${event?.event_code ?? ''}/staff\`` por `\`${buildEventUrl(event.event_code)}/staff\``.

**`supabase/functions/create-provider-user/index.ts`**
- Reemplazar la línea 107 por una función similar. Como aquí no hay `event_code` en scope (es `/provider`), basta con un helper `buildBaseUrl()` que solo limpia trailing slashes y posibles slugs accidentales del `APP_URL` — devolver siempre la base limpia.

#### B. Bitácora de envíos (requiere migración)

**Nueva tabla `invitation_send_log`**:
```sql
CREATE TABLE public.invitation_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid REFERENCES attendees(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  reason text,                  -- 'rate_limited' | 'invalid_recipient' | 'db_error' | 'resend_error' | 'cancelled' | 'invalid_email'
  error_message text,
  retries integer DEFAULT 0,
  attempted_by uuid REFERENCES auth.users(id),
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitation_log_attendee_attempted ON invitation_send_log(attendee_id, attempted_at DESC);
CREATE INDEX idx_invitation_log_event_status ON invitation_send_log(event_id, status, attempted_at DESC);

ALTER TABLE invitation_send_log ENABLE ROW LEVEL SECURITY;

-- Solo admin/superuser de la org del evento puede leer
CREATE POLICY "Admins read own org invitation logs"
  ON invitation_send_log FOR SELECT TO authenticated
  USING (event_id IN (
    SELECT e.id FROM events e
    WHERE has_role(auth.uid(), 'superuser'::app_role)
       OR has_org_role(auth.uid(), 'admin'::app_role, e.organization_id)
  ));

-- Solo edge functions (service_role) escriben
CREATE POLICY "Service writes invitation logs"
  ON invitation_send_log FOR INSERT TO service_role
  WITH CHECK (true);
```

**Modificar `send-invitation-email/index.ts`** — al final de cada `sendOneInvitation` y para cada skipped recipient, hacer `INSERT` en `invitation_send_log` con el resultado. Mismo cambio en `regenerate-access-code`.

**Nueva RPC para conteo rápido**:
```sql
CREATE FUNCTION get_failed_invitation_attendee_ids(_event_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Asistentes cuyo último intento falló o que nunca tuvieron intento exitoso
  SELECT DISTINCT a.id
  FROM attendees a
  WHERE a.event_id = _event_id
    AND a.deleted_at IS NULL
    AND a.registration_status != 'cancelled'
    AND a.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM invitation_send_log l
      WHERE l.attendee_id = a.id AND l.status = 'sent'
    )
    AND EXISTS (
      SELECT 1 FROM invitation_send_log l
      WHERE l.attendee_id = a.id AND l.status = 'failed'
    );
$$;
```

#### C. Reintento dirigido (UI admin)

**`src/services/admin-attendees.service.ts`**:
- Nueva función `getFailedInvitationIds(eventId)` que llama la RPC anterior.
- Nueva función `getInvitationLog(attendeeId)` que devuelve los últimos 10 intentos para un asistente (para mostrar en el detail drawer).

**`src/components/admin/attendees/BulkSendCredentialsModal.tsx`**:
- Agregar nueva categoría en el breakdown: "Fallidos en envío anterior" con conteo y opción a incluirlos.
- Si solo hay fallidos seleccionados, el botón principal cambia a "Reintentar envío".

**`src/components/admin/attendees/AttendeeDetailDrawer.tsx`**:
- Agregar mini-sección "Historial de envíos" con los últimos 3 intentos (timestamp + status + reason).

**`src/pages/admin/Attendees.tsx`**:
- En la barra de acciones masivas, nuevo botón "Reenviar fallidos" que:
  1. Llama `getFailedInvitationIds` para obtener los ids
  2. Si hay > 0, abre `BulkSendCredentialsModal` con esos preseleccionados.

#### D. i18n

Añadir las nuevas claves en `src/locales/es/admin.json` y `src/locales/en/admin.json`:
- `invitations.failed`: "Fallidos en envío anterior" / "Failed in previous send"
- `invitations.retryFailed`: "Reenviar fallidos" / "Retry failed"
- `invitations.history`: "Historial de envíos" / "Send history"
- `invitations.statusSent`, `invitations.statusFailed`, etc.

### Sin cambios en

- Flujo de autenticación (`verify-access-code`) — no toca URLs ni envía emails.
- Schema de `attendees` — `invitation_sent_at` se mantiene como timestamp del **último intento** (no del último éxito); los detalles finos viven en el log.
- Resend / configuración del dominio — la integración funciona; el problema real es la falta de visibilidad post-envío.

### Resultado esperado

| Problema | Antes | Después |
|---|---|---|
| URL `…/ACQFH-2026/ACQFH-2026` | Se filtra solo 1 nivel; staff/provider no se filtran nunca | TODAS las URLs limpian cualquier nivel de duplicación |
| Asistente sin email | Aparece "Invitado" en la UI sin forma de saber qué pasó | Aparece historial con razón ("invalid_recipient", "rate_limited") |
| Reintento masivo | Hay que reseleccionar manualmente y desactivar el filtro "ya invitado" | Botón "Reenviar fallidos" hace el filtro automático |
| Auditoría | Solo en logs de edge function (24h de retención) | Tabla persistente con índices, RLS, consultable desde UI |

### Verificación post-deploy

1. **URL fix**: temporalmente setear `APP_URL = https://congress-connect-app.lovable.app/ACQFH-2026/ACQFH-2026/` en secrets → enviar invitación de prueba a 1 asistente → confirmar que el link en el email es `…lovable.app/ACQFH-2026` (sin duplicar). Restaurar el secret correcto.
2. **Bitácora**: enviar invitación a 3 asistentes (1 con email válido, 1 con email inexistente tipo `noexiste@dominio-falso.xyz`, 1 cancelado) → consultar `SELECT * FROM invitation_send_log WHERE event_id = '…' ORDER BY attempted_at DESC LIMIT 10` → confirmar que aparecen 3 filas con `status` correcto.
3. **Reintento dirigido**: en la pantalla de admin → click "Reenviar fallidos" → confirmar que el modal preselecciona solo a los del paso 2 que fallaron.
4. **Historial en detail drawer**: abrir detail drawer de un asistente con 2+ intentos → confirmar que ve los últimos intentos con timestamp y razón.
5. **Staff y provider**: invitar 1 staff y 1 provider con el `APP_URL` correcto → confirmar que sus links son `…lovable.app/ACQFH-2026/staff` y `…lovable.app/provider` respectivamente (sin duplicaciones).

