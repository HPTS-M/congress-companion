

Reviso el contexto. El usuario pide planificar features para Logística y Proveedores. Necesito entender qué está implementado hoy antes de proponer.

Tengo del contexto:
- `admin-logistics.service.ts`: getAll/create/update/remove servicios, assignees, status updates con valores `'completed'`. El status del ticket se actualiza a `'completed'` cuando se valida.
- `admin-providers.service.ts`: CRUD providers, invite/resend/reinvite vía edge function, accessCode generator. Email se envía vía Resend.
- `attendee_services.status` default `'scheduled'`. Service tickets tienen `is_used`/`used_at`.
- `service_catalog` (no veo el schema aquí, pero se infiere de getAll) tiene name, service_type, valid_day, valid_from, valid_until, location, description.
- Providers tabla tiene: company_name, category, contact_email, access_code, last_login, login_count, password_changed, access_expires_at.
- `email-invitation-links` memoria: APP_URL strip trailing slash, formato `${APP_URL}/${event_code}`.

No veo en schema:
- Constraint UNIQUE en `service_catalog (event_id, name)` — confirma duplicidad no validada en BD.
- Constraint UNIQUE en `providers (event_id, contact_email)` o `(event_id, company_name)`.
- Tabla `provider_access_log` para historial.
- Estado nuevo en `service_catalog` (programado/cancelado/cumplido) — hoy solo hay status en `attendee_services` (scheduled/completed).

Confirmado: el plan abarca cambios DB + servicios + UI. Lo presento conciso.

---

# Plan: Logística + Proveedores — features V2

## MÓDULO LOGÍSTICA

### 1. Validar duplicidad en creación de servicios

**DB**: añadir UNIQUE constraint `service_catalog (event_id, lower(name))` (case-insensitive). Devuelve error 23505 que el frontend traduce.

**UI**: en `ServiceModal.tsx`, en `onSubmit` validar previamente con query `select id from service_catalog where event_id = ? and lower(name) = lower(?)` y mostrar error inline en el campo `name`. Si pasa la validación previa pero falla por race condition, capturar 23505 y mostrar toast.

### 2. Estados del servicio (catálogo) — programado / cancelado / cumplido

**Concepto**: hoy `service_catalog` no tiene estado propio (solo lo tienen los `attendee_services`). Agregar:
- Columna `status text default 'scheduled'` con valores: `scheduled`, `cancelled`, `completed`.
- Columna calculada/derivada: `completed` se infiere comparando `valid_day + valid_until` vs `now()`. NO se almacena — se calcula en frontend o en una `view`.

**Decisión**: usar **vista derivada** `service_catalog_with_status` que devuelve `effective_status`:
- `cancelled` si admin lo marcó manualmente
- `completed` si la fecha/hora ya pasó
- `scheduled` por defecto

Esto evita un cron job que actualice. El badge se calcula en tiempo de lectura.

**UI**:
- Badge en tabla `Logistics.tsx` con color: scheduled=azul, cancelled=rojo, completed=gris.
- Botón "Cancelar servicio" en menú de acciones (no borra, marca status='cancelled').
- Filtro por estado en tabs.

### 3. Flujo de estados de tickets: Pendiente → Confirmado → En curso → Completado

**Hoy**: `attendee_services.status` usa solo `scheduled` y `completed`. Falta `confirmed` y `in_progress`.

**Cambios**:
- Migrar `attendee_services.status` a enum/check constraint con valores: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`.
- Backfill: `scheduled` → `pending`.
- Actualizar `LogisticsAssign.tsx` para mostrar 5 estados con badges y permitir transiciones controladas (ej: no se puede pasar de `completed` a `pending`).
- Validador en service: función helper `getNextValidStatuses(current)` que devuelve los estados válidos siguientes.

**i18n**: claves `logistics.statusPending|Confirmed|InProgress|Completed|Cancelled` en es/en.

### 4. Optimizar actualización de rejilla

**Diagnóstico**: hoy `useAdminLogistics` invalida toda la query con `qc.invalidateQueries({ queryKey: key })` tras cada mutación → re-fetch completo.

**Optimizaciones**:
- **Optimistic updates** en `updateMutation` y `toggleMutation`: usar `qc.setQueryData()` para actualizar la fila localmente antes de la respuesta del server.
- **onError rollback**: snapshot previo + restore en caso de fallo.
- **Realtime subscription**: añadir channel a `service_catalog` y `attendee_services` para que cambios de otros admins se reflejen sin recargar (con cleanup en useEffect según memoria `realtime-cleanup-pattern`).
- **Debounce** en búsqueda de la tabla (actualmente filtra en cada keystroke).

### 5. Consistencia entre asignación masiva e individual

**Hoy**: 
- `assignAttendee` (individual) inserta una fila → trigger crea ticket.
- `bulkAssign` (masivo) itera y reporta `{assigned, errors}` → comportamiento diferente ante errores.

**Unificación**:
- Refactor `bulkAssign` para usar transacción con savepoint por attendee — si uno falla, los demás siguen, pero se loguea el motivo (no solo conteo).
- Devolver `{assigned, skipped: [{attendee_id, reason}], errors: [...]}`.
- En UI, mostrar modal con resumen detallado tras bulk assign.
- Validación previa común para ambos flujos: helper `canAssign(attendeeId, serviceCatalogId)` que verifica:
  - Attendee no esté ya asignado al mismo service
  - Attendee no esté `deleted_at`
  - Service no esté `cancelled`

---

## MÓDULO PROVEEDORES

### 1. Validar duplicidad en creación y edición

**DB**: 
- UNIQUE `providers (event_id, lower(contact_email)) where deleted` — email no puede repetirse en el mismo evento.
- UNIQUE `providers (event_id, lower(company_name))` opcional (con confirm en UI si coincide).

**UI** (`ProviderModal.tsx`):
- Validación previa en `onSubmit`: query a providers filtrando por evento + email.
- Si edita y email no cambió, omitir validación.
- Mensaje inline en el campo `contact_email`.
- Capturar 23505 como fallback.

### 2. Enlaces funcionales en correos de invitación y reenvío

**Diagnóstico**: la edge function `create-provider-user` ya construye `redirectTo = ${APP_URL}/${eventSlug}/provider`. Validar que:
- APP_URL no tenga trailing slash (memoria `email-invitation-links`).
- El link incluya un token o magic link válido (Supabase invite link ya lo hace).
- El email HTML tenga botón CTA + URL plana para clientes que bloquean botones.

**Cambios**:
- Auditar `supabase/functions/create-provider-user/index.ts` y verificar template HTML del email.
- Si el email actual solo manda link inválido, reescribir HTML con:
  - Botón "Acceder al portal"
  - URL plana debajo
  - Datos del evento
  - Código de acceso de 6 caracteres (el `access_code` de la tabla)
  - Fecha de expiración del acceso
- Para "resend": validar que se reutilice el mismo flow y no genere nuevo user.
- Edge function debe stripear trailing slash de APP_URL.

### 3. Historial de accesos y actividades del proveedor

**DB nueva tabla**:
```sql
provider_activity_log (
  id uuid pk,
  provider_id uuid fk,
  event_id uuid fk,
  activity_type text,  -- login | logout | service_view | ticket_validate | password_change
  metadata jsonb,      -- { service_id, attendee_id, ticket_code, ip, user_agent }
  created_at timestamptz
)
```
RLS: solo admin de la organización del evento puede leer. Provider NO ve su propio log.

**Triggers/Hooks**:
- En `providerPortalService.getProviderSession` (tras login exitoso): insertar activity `login`.
- En `provider_validate_ticket` RPC: insertar activity `ticket_validate` con metadata.
- En `getServiceAttendees`: insertar activity `service_view`.
- En cambio de password: activity `password_change`.

**UI Admin**:
- En `Providers.tsx` añadir columna/acción "Ver historial" → abre `ProviderActivityDrawer`.
- Drawer con timeline filtrable por tipo de actividad y rango de fechas.
- Export CSV del historial.

---

## ORDEN DE EJECUCIÓN (backend-first)

1. **Migración DB** (única, agrupada):
   - UNIQUE constraints (services + providers)
   - Columna `service_catalog.status`
   - Vista `service_catalog_with_status`
   - Migración de valores `attendee_services.status`
   - Tabla `provider_activity_log` + RLS + grants
2. Regenerar `types.ts` (automático)
3. Actualizar servicios: `admin-logistics.service.ts`, `admin-providers.service.ts`, `provider-portal.service.ts`
4. Actualizar edge functions: `create-provider-user` (email HTML)
5. Crear hook `useProviderActivityLog`
6. Actualizar UI: `ServiceModal`, `Logistics.tsx`, `LogisticsAssign.tsx`, `ProviderModal`, `Providers.tsx`, nuevo `ProviderActivityDrawer.tsx`
7. i18n es/en
8. QA

## ARCHIVOS A TOCAR

| Tipo | Archivo |
|---|---|
| Migración | 1 SQL nueva |
| Service | admin-logistics, admin-providers, provider-portal |
| Edge fn | create-provider-user (email HTML) |
| Hook | useAdminLogistics, useAdminProviders, **useProviderActivityLog (nuevo)** |
| UI Logística | ServiceModal, Logistics.tsx, LogisticsAssign.tsx |
| UI Providers | ProviderModal, Providers.tsx, **ProviderActivityDrawer.tsx (nuevo)** |
| i18n | locales/{es,en}/admin.json |

## PREGUNTAS BLOQUEANTES

1. **Estado `cancelled` en service_catalog**: cuando un admin cancela un servicio del catálogo, ¿qué pasa con los `attendee_services` ya asignados? Opciones:
   - (a) Cancelar todos los tickets en cascada
   - (b) Bloquear la cancelación si hay attendees asignados
   - (c) Solo marcar el catálogo, dejar tickets activos (admin decide manualmente)

2. **Historial de proveedor**: ¿qué retención de datos? ¿90 días, 1 año, indefinido? Afecta políticas de purga.

3. **Email de proveedor**: ¿el código de acceso de 6 caracteres debe verse en el email? Hoy se usa para login alterno además del magic link.

4. **Flujo de estados de ticket**: ¿quién puede cambiar a `in_progress`? ¿Solo el provider al iniciar el servicio (ej: bus arrancando) o también el admin?

## VERIFICACIÓN POST-CAMBIOS

| # | Prueba | Criterio |
|---|---|---|
| 1 | Crear servicio con nombre duplicado | Error inline en campo name |
| 2 | Crear proveedor con email duplicado en mismo evento | Error inline |
| 3 | Cambiar status ticket pending→confirmed→in_progress→completed | Transiciones permitidas, badges actualizados |
| 4 | Intentar ir de completed→pending | Bloqueado |
| 5 | Cancelar servicio del catálogo | Badge "Cancelado", según decisión Q1 |
| 6 | Servicio con valid_until ya pasado | Badge automático "Cumplido" en lectura |
| 7 | Editar fila + ver actualización en tabla | Sin re-fetch completo (optimistic) |
| 8 | Bulk assign 50 attendees, 3 ya asignados | Reporta 47 ok + 3 skipped con motivo |
| 9 | Invitar proveedor + abrir email | Botón funcional, redirige al portal |
| 10 | Login proveedor + validar ticket | Activity log registra ambos eventos |
| 11 | Admin ve historial de proveedor | Timeline con filtros funciona |
| 12 | Mobile 360px todos los modales | Sin overflow |
| 13 | Dark mode badges nuevos | Contraste correcto |
| 14 | i18n es/en | Todas las claves presentes |
| 15 | `supabase--linter` post-migración | 0 nuevos warnings |

