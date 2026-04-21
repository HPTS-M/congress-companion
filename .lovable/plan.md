

## Plan de ajustes — Asistentes, Staff, Reportes, Logística, Proveedores

### 1. Asistentes — Inconsistencia "Reintentar pendientes"

**Causa raíz:** la tarjeta "Pendientes" cuenta `registration_status='pending'`, pero el botón cuenta asistentes con `invitation_sent_at IS NULL` (independiente del estado). Por eso vemos `0` en la tarjeta y `585` en el botón: hay 585 asistentes ya confirmados/importados que nunca recibieron correo.

**Fix (según tu elección):** filtrar también por `registration_status='pending'` en `getPendingInvitationIds()`. Así el contador del botón coincidirá con la tarjeta. Los asistentes confirmados sin correo se atenderán mediante "Reintentar fallidos" o el envío manual desde el detalle.

- Editar: `src/services/admin-attendees.service.ts` → agregar filtro `.eq('registration_status', 'pending')`.

### 2. Asistentes — Acciones agrupadas en mobile

**Bug colateral detectado:** el JSX de `Attendees.tsx` (líneas 364-405) tiene el bloque "Reintentar fallidos" mal anidado dentro de "Reintentar pendientes". Lo arreglamos de paso.

**Implementación mobile:** reemplazar la columna de 3 botones verticales en el listado mobile por un único `DropdownMenu` con icono engranaje (`Settings`) que contenga: Editar, Activar/Desactivar, Eliminar. El desktop conserva los iconos individuales.

- Editar: `src/components/admin/attendees/AttendeesTable.tsx` (sección `md:hidden`).
- Editar: `src/pages/admin/Attendees.tsx` (corregir anidación JSX).

### 3. Staff y Reportes — Tooltips descriptivos

Envolver los botones de acción clave (invitar/reenviar/editar/eliminar/activar en Staff; exportar/refrescar/cambiar tab en Reportes) con el componente `Tooltip` de shadcn (ya disponible en `src/components/ui/tooltip.tsx`). Reemplazar los `title=` HTML actuales por tooltips accesibles con `TooltipProvider` a nivel de página.

- Editar: `src/pages/admin/Staff.tsx`, `src/pages/admin/Reports.tsx`.
- Agregar claves i18n en `es/admin.json` y `en/admin.json` bajo `staff.tooltips.*` y `reports.tooltips.*`.

### 4. Logística — Tooltips de fecha en columna Estado

En la tabla de servicios, envolver el badge de estado con un `Tooltip`:
- **Programado** → tooltip muestra `valid_from` (fecha programada).
- **Finalizado** → tooltip muestra `completed_at`.
- **Cancelado** → tooltip muestra solo el texto "Servicio cancelado" (sin fecha).
- **Activo/sin estado** → sin tooltip (o "Servicio activo").

Quitar el texto inline de fecha que hoy se muestra al lado del badge "Finalizado" para limpiar la columna.

- Editar: `src/pages/admin/Logistics.tsx` (sección de la tabla, líneas ~280-295).
- Agregar claves i18n: `logistics.statusTooltipScheduled`, `logistics.statusTooltipCompleted`, `logistics.statusTooltipCancelled`.

### 5. Proveedores — Validación de nombre duplicado

**Backend (migración):**
- Crear índice único parcial: `CREATE UNIQUE INDEX providers_event_company_name_unique ON providers (event_id, lower(company_name)) WHERE company_name IS NOT NULL;`

**Servicio:**
- Editar `src/services/admin-providers.service.ts` → en `create()` y `update()`, mapear el código `23505` con detalle del índice `providers_event_company_name_unique` a un error `DUPLICATE_NAME`.
- Pre-validación opcional client-side: consultar antes de insertar para mostrar error inmediato en el form.

**UI:**
- Editar `src/components/admin/providers/ProviderModal.tsx` → manejar `DUPLICATE_NAME` igual que se maneja hoy `DUPLICATE_EMAIL`, mostrando error bajo el campo "Razón social".
- Claves i18n: `providers.duplicateName`.

### 6. Proveedores — Error en invitación / reinvitación

**Causa raíz:** la edge function `create-provider-user` cuando recibe el error de Supabase Auth `"A user with this email address has already been registered"` intenta recuperar al usuario con `users.find(u => u.email === email)`. Esto falla cuando:
- El email tiene diferencias de mayúsculas/minúsculas, o
- `listUsers()` no devuelve al usuario en la primera página (por defecto pagina a 50), o
- El usuario existe pero no se encontró → cae en el `return 400` final propagando el mensaje crudo al cliente.

**Fix edge function (`supabase/functions/create-provider-user/index.ts`):**
1. Comparar emails normalizados a `lower()` en el `find`.
2. Usar `adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })` o iterar páginas hasta encontrarlo.
3. Si tras la búsqueda el usuario sigue sin aparecer, devolver mensaje claro: `"USER_EXISTS_NOT_FOUND — contacta soporte"` con status 409 (no 400 con stack genérico).
4. En `action === "reinvite"`: si el `provider.user_id` es `null` pero el email ya existe en Auth, ejecutar el mismo flujo "linked_existing" (vincular al provider sin crear usuario nuevo).
5. Validar que el `inviteLink` se construya correctamente concatenando `redirectTo` (ya se sanea con `replace(/\/+$/, '')`, mantener).

**Frontend (`src/services/admin-providers.service.ts`):**
- Mapear el nuevo código `USER_EXISTS_NOT_FOUND` a un mensaje i18n claro en `Providers.tsx` (toast destructivo con instrucción de usar "Cambiar email y reinvitar").

### Orden de ejecución (Backend-First)
1. Migración DB: índice único `providers_event_company_name_unique`.
2. Edge function `create-provider-user`: arreglar lookup case-insensitive + paginación + reinvite con email existente.
3. Servicios: `admin-attendees.service.ts` (filter status), `admin-providers.service.ts` (DUPLICATE_NAME).
4. Componentes UI: `AttendeesTable` (dropdown mobile), `Attendees.tsx` (fix JSX), `ProviderModal` (error nombre), `Logistics.tsx` (tooltips fecha), `Staff.tsx` + `Reports.tsx` (tooltips).
5. i18n: nuevas claves en `es/admin.json` y `en/admin.json`.
6. QA: probar en preview el flujo de retry pendientes, invitación a proveedor con email existente, y vista mobile de asistentes.

