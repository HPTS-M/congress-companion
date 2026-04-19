

## Plan: Mejoras Proveedores + Comunicaciones

### Decisiones del usuario
- **Programación**: dentro del modal de "Nuevo anuncio" hay opción "Enviar ahora" o "Programar para fecha/hora". A la hora programada los confirmados reciben push + ven anuncio.
- **Editar programado**: título, cuerpo y nueva hora. Botón "Reenviar ahora" para envío inmediato.
- **Editar enviado**: campo `last_edited_at`. Permitir editar/reenviar solo si título o cuerpo cambiaron (validación de cambios reales).
- **Logs proveedor**: 90 días (sin cambios).

---

### Fase 1 — Migración BD

`announcements`:
- `ADD COLUMN scheduled_for timestamptz NULL` (null = inmediato).
- `ADD COLUMN updated_at timestamptz DEFAULT now()` + trigger `update_updated_at`.
- `ADD COLUMN last_edited_at timestamptz NULL` (se llena solo en ediciones, no en creación).
- `ADD COLUMN last_resent_at timestamptz NULL` (track de reenvíos).
- Backfill: `UPDATE announcements SET sent_at = COALESCE(sent_at, created_at)`.
- `CREATE UNIQUE INDEX announcements_event_title_unique ON announcements (event_id, lower(title))`.
- Habilitar `pg_cron` + `pg_net`.
- Cron cada minuto → invoca edge function `dispatch-scheduled-announcements`.

### Fase 2 — Edge Functions

**`dispatch-scheduled-announcements`** (nueva, `verify_jwt: false` con secret guard):
- Busca anuncios donde `scheduled_for <= now() AND sent_at IS NULL`.
- Marca `sent_at = now()`, recalcula `reach_count` (asistentes confirmados al momento del envío).
- (Push notifications quedan fuera de scope si no existen aún; este cron habilita el "momento de visibilidad" para los attendees vía la tabla.)

**`create-provider-user`** (ajuste):
- `APP_URL.replace(/\/+$/, '')` antes de construir links.
- Asegurar template de **resend** idéntico al **invite**: link clickable + access code visible.
- Confirmar log `invitation_sent` / `invitation_resent`.

### Fase 3 — Servicios y hooks

**`admin-communications.service.ts`**:
- `createAnnouncement(eventId, { title, body, scheduledFor? })` → captura 23505 = `DUPLICATE_TITLE`.
- `updateAnnouncement(id, { title, body, scheduledFor? })` → permitido siempre; si `sent_at IS NOT NULL`, marca `last_edited_at = now()`.
- `resendAnnouncement(id)` → valida que título/cuerpo cambiaron desde último envío (compara con snapshot guardado o con `last_edited_at > sent_at`); si no cambió, retorna `NO_CHANGES`. Si cambió, marca `sent_at = now(), last_resent_at = now(), reach_count = recalculado`.
- `cancelScheduled(id)` → delete físico.
- `getAnnouncements`: incluir nuevos campos; ordenar programados pendientes primero, luego enviados desc.
- **Eliminar**: `getGroupChatMessages`, `getAttendeeNames`, `deleteMessage` y los hooks `useAdminGroupChat`, `useAdminAttendeeNames`, `useDeleteChatMessage`.

**`admin-providers.service.ts`**:
- `getActivityLog(providerId, { from?, to?, type? })` → lectura de `provider_activity_log` con filtros.

### Fase 4 — UI Admin

**Comunicaciones (`Communications.tsx`)**:
- Eliminar `<TabsTrigger value="chat">` y todo el panel de chat moderation.
- `AnnouncementModal` (renombre de NewAnnouncementModal) con modo crear/editar:
  - Radio "Enviar ahora" vs "Programar".
  - DateTimePicker (mínimo `now() + 1 min`) cuando elige programar.
  - Validación inline `DUPLICATE_TITLE`.
- Lista en dos secciones:
  - **Programados** (badge ámbar `Programado para …`): acciones Editar / Cancelar.
  - **Enviados**: badge `Enviado · {fecha}`, si `last_edited_at` muestra `Editado · {fecha}`, botón "Editar" + "Reenviar" (deshabilitado si título y cuerpo iguales al snapshot).

**Proveedores**:
- `ProviderModal`: capturar `DUPLICATE_EMAIL` y mostrar error inline en input email (crear y editar).
- Nuevo `ProviderActivityDrawer.tsx`:
  - Timeline cronológico (más reciente arriba) con icono por `activity_type`.
  - Filtros: rango fecha + select tipo.
  - Botón "Exportar CSV" con ExcelJS.
- Botón "Ver actividad" en cada fila de `Providers.tsx`.

### Fase 5 — i18n (es/en)

Agregar a `admin.json`:
- `announcements`: `duplicateTitle`, `scheduleFor`, `sendNow`, `scheduled`, `scheduledFor`, `editTitle`, `cancelScheduled`, `resend`, `noChangesToResend`, `lastEdited`, `lastResent`.
- `providers`: `viewActivity`, `activityHistory`, `activityLogin`, `activityTicketValidated`, `activityInvitationSent`, `activityInvitationResent`, `filterByDate`, `filterByType`, `exportCsv`, `noActivity`.
- Eliminar claves chat moderation.

### Fase 6 — Verificación

| # | Caso | Esperado |
|---|------|----------|
| 1 | Crear anuncio con título existente | Error inline `DUPLICATE_TITLE` |
| 2 | Programar +5 min | Aparece en sección Programados |
| 3 | Cron despacha programado | `sent_at` se llena, pasa a Enviados |
| 4 | Editar programado (título, cuerpo, hora) | Persiste cambios |
| 5 | Cancelar programado | Eliminado |
| 6 | Editar enviado y reenviar | Marca `last_edited_at` + `last_resent_at`, `sent_at` actualizado |
| 7 | Reenviar sin cambios | Bloqueado con `NO_CHANGES` |
| 8 | Tab "Chat" admin | No existe |
| 9 | Editar proveedor email duplicado | Error inline |
| 10 | Resend invite proveedor | Email con link funcional + código |
| 11 | Drawer actividad proveedor | Timeline + filtros + CSV |
| 12 | Mobile 360px | Sin overflow |
| 13 | i18n es/en | Completo |
| 14 | `supabase--linter` | 0 nuevos warnings |

