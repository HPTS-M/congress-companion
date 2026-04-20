

## Plan: Hacer consistente el envío de credenciales para todos los registros

### Diagnóstico — por qué algunos asistentes no reciben el código

Analicé el flujo completo (`ImportCsvModal` → `useSendInvitations` → `sendInvitations` service → `send-invitation-email` Edge Function → Resend). Encontré **6 causas independientes** que hacen que el envío falle silenciosamente o se omita por completo.

| # | Causa | Síntoma |
|---|---|---|
| 1 | **Import con status "pending" no envía nada.** `ImportCsvModal` solo invoca `sendInvitations` si `importStatus === 'confirmed'` (líneas 423 y 463). Si el admin importa con status pending, nunca se envían emails. | "Importé 50 personas y nadie recibió correo" |
| 2 | **Errores de envío durante import se tragan.** En las líneas 426-428 y 466-468 se hace `try/catch` con solo `console.error`. El admin ve "Importación exitosa" aunque 0 emails hayan salido. | Falsa sensación de éxito |
| 3 | **Edge function se cuelga / corta** en lotes grandes. `bcrypt.hashSync(code, 10)` toma ~250-400 ms en edge runtime. Con un lote de 200 (max permitido por el schema), bcrypt solo ya consume ~60-80 s, **superando el timeout de 60 s de Edge Functions**. Los últimos asistentes del lote nunca reciben email pero la respuesta no llega al cliente. | Asistentes intermitentes sin email, sin patrón visible |
| 4 | **Sin reintentos ante 429/5xx de Resend.** Resend tiene rate limit de ~10 req/s y devuelve 429 ocasionalmente. Hoy un solo 429 marca al asistente como `failed` y nunca se reintenta. | Fallos transitorios = asistentes permanentemente sin email |
| 5 | **Email inválido falla todo el lote** sólo si pasa la regex pero Resend lo rechaza (TLD raro, mailbox inexistente conocido). Va a `errors[]` y nunca se notifica al admin de cuáles fueron. | Admin no sabe qué emails corregir |
| 6 | **Sin botón de "reintentar fallidos"**. Aunque el resultado venga con `errors: [{id, error}]`, hoy se descarta. La única forma de reintentar es seleccionar manualmente en la tabla. | Trabajo manual repetitivo, fácil olvidar |

### Solución — 3 capas

**Capa A · Edge function robusta** (`supabase/functions/send-invitation-email/index.ts`)

1. **Procesar por chunks de 20** dentro del request, con `await Promise.allSettled` por chunk, para que un fallo individual no bloquee el resto.
2. **Bajar bcrypt cost de 10 → 8** (sigue siendo seguro: 2^8 = 256 rounds, recomendado para auth temporal). Reduce hashing de 300 ms → 80 ms por código. Lote de 200 baja de ~60 s a ~16 s.
3. **Reintentos con backoff** ante 429 / 5xx de Resend: 3 intentos con esperas de 500 ms → 1.5 s → 4 s. Solo se marca como failed después del 3er intento.
4. **Validación previa de email más estricta**: ya filtra por regex; agregar log estructurado `console.log('[send-invitation]', { attendee_id, email, status })` por cada intento, para que los logs de Edge Functions sean útiles para auditar.
5. **Devolver lista detallada de fallidos con motivo legible** (`'rate_limited' | 'invalid_recipient' | 'resend_error' | 'db_error'`) además del mensaje técnico.
6. **Bajar el cap del schema de 200 → 50 por request** y dejar que el cliente pagine. Esto elimina el riesgo de timeout incluso en el peor caso.

**Capa B · Servicio + hook frontend** (`src/services/admin-attendees.service.ts`, `src/hooks/useAdminAttendees.ts`)

1. **Auto-paginar en el cliente**: `sendInvitations()` divide `attendeeIds` en chunks de 50 y hace requests secuenciales, agregando los resultados (`sent`, `failed`, `errors`, `skippedDetails`) en un único `SendInvitationsResult`.
2. **Timeout explícito por request** (50 s) con `AbortController`. Si un chunk excede, se reporta como `failed` con motivo `timeout` y se sigue con el siguiente.
3. **Mejor mensaje de error** cuando `response.ok === false` (incluir status HTTP en el throw para que el toast del admin sea accionable).

**Capa C · Flujos UI consistentes** (`ImportCsvModal.tsx`, `Attendees.tsx`)

1. **Importación siempre envía credenciales** independientemente de `importStatus`. Si el admin importó como "pending", igual se les manda el email para que puedan auto-confirmarse al hacer login (que ya es el comportamiento existente — ver `verify-access-code` que cambia pending → confirmed automáticamente).
2. **Mostrar resultado real en el toast post-import**: en vez de "Importación exitosa", mostrar `"Importados: X · Credenciales enviadas: Y · Fallidos: Z"`. Si hay fallidos, abrir un sub-modal con la lista (reusar `ImportErrorsModal` existente, agregar columna "motivo email").
3. **Botón "Reintentar credenciales fallidas"** en el resumen post-import y en la pantalla principal de asistentes (cuando hay asistentes con `invitation_sent_at IS NULL` y email válido).
4. **Indicador visual en la tabla**: badge "Sin invitación" en la columna de estado para asistentes con email válido pero `invitation_sent_at = NULL` y `registration_status != 'cancelled'`. Permite al admin detectar de un vistazo a quién falta enviarle.

### Cambios concretos

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-invitation-email/index.ts` | Chunks de 20 con Promise.allSettled · bcrypt cost 8 · retry con backoff · logs estructurados · cap a 50/request |
| `src/services/admin-attendees.service.ts` | `sendInvitations` auto-pagina en chunks de 50 y agrega resultados · AbortController con timeout 50s |
| `src/components/admin/attendees/ImportCsvModal.tsx` | Enviar credenciales siempre (no solo si confirmed) · mostrar resultado real del envío en `importResult` · sub-modal con fallidos |
| `src/pages/admin/Attendees.tsx` | Botón "Reintentar credenciales pendientes" en barra de acciones · query para listar asistentes sin invitation_sent_at |
| `src/components/admin/attendees/AttendeesTable.tsx` | Badge "Sin invitación" en columna de status |
| `src/locales/es/admin.json` y `en/admin.json` | Nuevas keys: `bulkSendRetryPending`, `noInvitationBadge`, `bulkSendDetailedResult`, `errorMotive.*` |

### Lo que NO se modifica

- **RLS, schema, datos**: cero cambios.
- **`verify-access-code`**: ya funciona; el flujo de login no se toca.
- **`auth-email-hook` / templates de Lovable**: no aplica; este flujo usa Resend directo (no es un magic link de Supabase Auth, es un código de 8 caracteres custom).
- **Nuevas dependencias**: ninguna.

### Aclaración importante sobre "Magic Link"

El usuario mencionó "Magic Link" pero el sistema actual NO usa magic links de Supabase Auth para asistentes — usa un **código alfanumérico de 8 caracteres** generado por la edge function, hasheado con bcrypt y verificado contra `verify-access-code`. El email contiene tanto el código como un botón "Open Event App" que lleva a `/{event_code}` donde el asistente debe pegar el código. Mantenemos este flujo porque cambiarlo a magic link real implicaría rehacer auth completa (fuera de alcance). El plan asegura que **ese email con el código siempre llegue de forma consistente**.

### Resultado esperado

| Escenario | Antes | Después |
|---|---|---|
| Importar 100 asistentes con status=confirmed | Algunos sin email, sin saber cuáles | 100/100 reciben, o admin ve lista de fallidos |
| Importar 100 con status=pending | 0 emails enviados, sin aviso | 100 reciben, status=pending hasta que hagan login |
| Lote de 200 (UI llama bulk send) | Edge function timeout, lote queda a medias | Cliente pagina en 4 chunks de 50, todos procesados |
| Resend devuelve 429 a uno | Marcado failed para siempre | 3 reintentos con backoff, casi siempre se recupera |
| Email con typo (juan@gmial.com) | Falla y se pierde el motivo | Aparece en lista de fallidos con motivo "invalid_recipient" |
| Asistente quedó sin invitación por bug previo | Solo seleccionar uno por uno | Botón "Reintentar pendientes" los procesa todos |

### Verificación post-deploy (5 min)

1. Importar CSV de 60 asistentes con status=pending → confirmar que toast muestra "Importados: 60 · Credenciales enviadas: 60".
2. Importar otros 5 con un email mal formado (`x@y`) → confirmar que aparecen en sub-modal de fallidos con motivo claro.
3. Seleccionar 3 asistentes ya invitados + activar "resend" → confirmar que se reenvía y `invitation_sent_at` se actualiza.
4. Click en "Reintentar credenciales pendientes" → procesa solo los que tenían `invitation_sent_at IS NULL`.
5. Revisar logs de Edge Function: cada intento con `{ attendee_id, status, retry_count }`.

