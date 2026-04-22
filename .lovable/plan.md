

## Plan — Regeneración masiva de códigos para desbloquear los 812 asistentes

### Objetivo
Permitir al admin regenerar y reenviar credenciales a múltiples asistentes en un solo flujo, poblando automáticamente `access_code_lookup` para que todos puedan loguear sin timeouts.

### Cambios

#### 1) Nueva Edge Function: `bulk-regenerate-access-codes`
Archivo: `supabase/functions/bulk-regenerate-access-codes/index.ts`

- Auth: requiere JWT de admin (verifica rol vía `has_role`).
- Input validado con Zod:
  ```typescript
  {
    event_id: string (uuid),
    filter: 'all' | 'never_logged_in' | 'failed_invitations',
    offset: number (default 0),
    batch_size: number (default 50, max 50)
  }
  ```
- Lógica:
  1. Cuenta total elegible según filtro (devuelve `total` en respuesta).
  2. Trae lote de 50 asistentes ordenados por `created_at`.
  3. Para cada asistente:
     - Genera nuevo código de 8 chars.
     - Calcula `bcrypt.hashSync` + `access_code_lookup = code.substring(0,4).toUpperCase()`.
     - Update `attendees` con ambos campos.
     - Encola envío de correo via Resend (reusa template de `send-invitation-email`).
  4. Throttling de 2 correos/segundo (respeta rate limit del plan Resend).
- Output:
  ```typescript
  {
    processed: number,
    failed: number,
    remaining: number,
    next_offset: number,
    errors: Array<{ attendee_id, reason }>
  }
  ```
- Diseñada para ser llamada en bucle desde el frontend hasta `remaining = 0`.

#### 2) Servicio frontend: `bulkRegenerateAccessCodes`
Archivo: `src/services/admin-attendees.service.ts`

- Función que orquesta llamadas paginadas a la Edge Function.
- Acepta callback `onProgress({ processed, total })` para actualizar UI.
- Maneja reintentos de lotes con error.
- Devuelve resumen final agregado.

#### 3) Hook React Query: `useBulkRegenerateAccessCodes`
Archivo: `src/hooks/useAdminAttendees.ts`

- Mutation con invalidación de cache de attendees al finalizar.
- Expone estado `progress` para barra de progreso.

#### 4) Modal de confirmación: `BulkRegenerateModal`
Archivo: `src/components/admin/attendees/BulkRegenerateModal.tsx`

UI:
- Título: "Regenerar códigos masivamente"
- Advertencia destacada en amber/yellow:
  > "⚠️ Esta acción invalidará los códigos actuales de los asistentes seleccionados y enviará nuevos por correo. Los códigos anteriores dejarán de funcionar."
- 3 radio options con conteo dinámico:
  - 🔵 Solo los que **nunca se han logueado** (recomendado) — `~X asistentes`
  - 🟡 Solo los que tienen **invitación fallida** — `~X asistentes`
  - 🔴 **Todos los asistentes** — `~812 asistentes`
- Texto explicativo:
  > "Por motivos técnicos relacionados con el alto volumen de asistentes, los códigos actuales serán reemplazados. Cada asistente recibirá un correo con su nuevo código. Esta acción solo es necesaria una vez."
- Botón "Cancelar" + "Regenerar y enviar correos" (destructive variant).
- Durante ejecución: barra de progreso con `X de Y procesados (Z% completado)`.
- Al terminar: resumen con éxitos/fallos + opción de descargar CSV de errores si hay.

#### 5) Botón de acceso en panel admin
Archivo: `src/pages/admin/Attendees.tsx`

- Agregar botón "Regenerar códigos" en el dropdown menu del header (junto a "Importar CSV", "Exportar Excel").
- Icono: `RefreshCw` de lucide-react.
- Solo visible para admins (ya está protegido por `AdminRoute`).

#### 6) Traducciones
Archivos: `src/locales/es/admin.json` y `src/locales/en/admin.json`

Nuevas keys bajo `attendees.bulkRegenerate.*`:
- `title`, `warning`, `description`, `filterAll`, `filterNeverLoggedIn`, `filterFailed`, `cancel`, `confirm`, `progress`, `successSummary`, `errorSummary`, `downloadErrors`.

### Flujo del usuario

```
Admin → Asistentes → menú "⋮" → "Regenerar códigos masivamente"
  → Modal con 3 opciones + advertencia
  → Click "Regenerar y enviar correos"
  → Barra de progreso (≈7-10 min para 812 asistentes)
  → Resumen: "812 procesados, 810 enviados, 2 sin email"
  → Asistentes reciben correo con código nuevo
  → Cualquier login posterior funciona en <500ms
```

### Lo que NO se cambia
- `verify-access-code` — ya está optimizada y funcionará automáticamente con los nuevos lookups.
- Esquema de DB — la columna y el índice ya existen.
- `regenerate-access-code` (single attendee) — sigue funcionando; el admin puede usarla en paralelo para casos urgentes.
- Frontend de login del asistente — sin cambios.
- Plantilla de correo de invitación — se reusa la existente.

### Verificación post-implementación

1. Admin presiona "Regenerar códigos masivamente" → "Solo los que nunca se han logueado".
2. Barra de progreso avanza correctamente, sin errores en consola.
3. Query SQL: `SELECT COUNT(*) FROM attendees WHERE access_code_lookup IS NOT NULL` → debe coincidir con procesados.
4. Login con código nuevo → entra en <1 segundo.
5. Logs de `verify-access-code` → 0 errores `CPU Time exceeded`.
6. Logs de `bulk-regenerate-access-codes` → todos los lotes terminan en <30s wall-clock.

### Archivos a crear/modificar

**Nuevos:**
- `supabase/functions/bulk-regenerate-access-codes/index.ts`
- `src/components/admin/attendees/BulkRegenerateModal.tsx`

**Modificados:**
- `src/services/admin-attendees.service.ts` — agregar `bulkRegenerateAccessCodes`
- `src/hooks/useAdminAttendees.ts` — agregar `useBulkRegenerateAccessCodes`
- `src/pages/admin/Attendees.tsx` — agregar botón en menú
- `src/locales/es/admin.json` y `src/locales/en/admin.json` — traducciones

