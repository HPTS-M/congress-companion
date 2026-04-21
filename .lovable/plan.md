

## Plan de ajustes — Tooltips, Proveedores, Logística

### 1. TRANSVERSAL — Tooltips en badges de estado

**Personal Staff** (`src/pages/admin/Staff.tsx`)
- Envolver badges de la columna "Invitación" (Activo / Pendiente) con `Tooltip` + `TooltipTrigger`.
  - Activo: "El miembro de personal ya activó su cuenta y puede ingresar al portal."
  - Pendiente: "Aún no se ha enviado o aceptado la invitación. Actívalo desde el botón de check."
- Envolver el `Switch` + texto de la columna "Acceso" en otro `Tooltip`.
  - Habilitado: "Acceso activo. Puede iniciar sesión en el portal Staff."
  - Suspendido: "Acceso revocado temporalmente. No podrá iniciar sesión hasta restaurarlo."

**Reportes** (`src/pages/admin/Reports.tsx`)
- Envolver las 4 tarjetas KPI (`StatCard`) con tooltips explicativos:
  - Total asistentes: "Asistentes registrados en el evento (excluye eliminados)."
  - Sesiones realizadas: "Sesiones del programa con al menos un check-in."
  - Promedio calificaciones: "Promedio simple de las estrellas dadas por los asistentes a todas las sesiones."
  - Servicios entregados: "Tickets logísticos marcados como usados (escaneo QR + validación manual)."
- Modificar `StatCard` para aceptar un prop opcional `tooltip?: string`.

Nuevas claves en `src/locales/es/admin.json` y `en/admin.json`:
```
staff.tooltips.statusActive, staff.tooltips.statusPending,
staff.tooltips.accessEnabled, staff.tooltips.accessDisabled,
reports.tooltips.kpiAttendees, reports.tooltips.kpiSessions,
reports.tooltips.kpiAvgRating, reports.tooltips.kpiUsedTickets
```

---

### 2. PROVEEDORES — Error 'non-2xx' al invitar/reenviar

**Diagnóstico**: la función `create-provider-user` no tiene logs recientes (no se llegó a bootear o el error no se registró). Antes de cambiar lógica, hay que:

1. **Redesplegar** la función para forzar reboot limpio.
2. **Reproducir** el flujo desde Proveedores con `curl_edge_functions` y leer los logs en vivo (status, payload de error).
3. Causas más probables a inspeccionar:
   - `findAuthUserByEmail` paginando 20 páginas puede caer en timeout cuando hay > 200 usuarios y el correo no existe → reducir a 5 páginas y devolver error claro.
   - `adminClient.from("providers").select(...).single()` falla silencioso si el provider fue creado sin `access_code`. Cambiar a `maybeSingle()`.
   - Falta validación cuando `eventInfo` viene null → 500 en `eventData?.organization_id`.
4. **Endurecer manejo de errores**: capturar cada bloque (`adminClient.auth.admin.generateLink`, `sendInviteEmail`, etc.) y devolver `4xx` con mensaje específico en lugar de `throw` que cae al `catch` genérico 500.
5. **Log estructurado** en cada paso: `console.log('[invite-provider]', step, providerId)` para que aparezcan en Edge Function logs.
6. Frontend `admin-providers.service.ts`: cuando `error?.message` venga vacío y `data?.error` exista, usar `data.error` como mensaje del toast (hoy se muestra el genérico).

---

### 3. LOGÍSTICA — Fechas de inicio y fin del servicio

**Migración de base de datos** (cambio de esquema):

```sql
ALTER TABLE public.service_catalog
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN ends_at   timestamptz;

-- Backfill de datos existentes a partir de valid_day + valid_from/valid_until + events.start_date
-- (valor compuesto: event.start_date + (valid_day-1) días + valid_from)
UPDATE public.service_catalog sc
SET starts_at = (e.start_date + (COALESCE(sc.valid_day,1) - 1)) + COALESCE(sc.valid_from,'00:00')::time,
    ends_at   = (e.start_date + (COALESCE(sc.valid_day,1) - 1)) + COALESCE(sc.valid_until,'23:59')::time
FROM public.events e
WHERE sc.event_id = e.id AND sc.starts_at IS NULL;
```

Las columnas viejas `valid_from/valid_until/valid_day` se conservan por ahora (compatibilidad con `provider_portal` y vistas) y se marcarán como deprecadas en código. Una migración futura las eliminará.

**Vista `service_catalog_with_status`** — recalcular `effective_status` en función de `starts_at` / `ends_at`:
```
status = 'cancelled'   → 'cancelled'
ends_at < now()        → 'completed'
starts_at <= now()     → 'in_progress' (opcional, mostrar como 'scheduled')
sino                   → 'scheduled'
```

**Modal de creación/edición** (`src/components/admin/logistics/ServiceModal.tsx`)
- Reemplazar los dos inputs `type="time"` por dos inputs `type="datetime-local"`:
  - "Inicio del servicio" (fecha + hora)
  - "Fin del servicio" (fecha + hora)
- Validación Zod: `ends_at` posterior a `starts_at`; ambos opcionales pero si uno está, el otro también.
- Mantener un layout responsivo (apilados en mobile, lado a lado en desktop).

**Tabla en `src/pages/admin/Logistics.tsx`**
- Reemplazar la columna "Programación" actual por dos celdas en una sola columna:
  - `Inicio: 23/abr 08:00`
  - `Fin: 23/abr 12:00`
- Helper `formatDateTime(iso)` con `date-fns` y locale `es`.
- Estado del servicio (badge):
  - Cancelado (rojo) — si `status='cancelled'`
  - Finalizado (gris) — si `ends_at < now`
  - Programado (teal) — caso por defecto
- Tooltips de badges actualizados con la fecha/hora real.

**Servicio** (`src/services/admin-logistics.service.ts`)
- Tipo `ServiceCatalogRow`: agregar `starts_at: string | null; ends_at: string | null`.
- Tipo `ServiceCatalogForm`: agregar los mismos. Mantener compatibilidad con campos viejos enviando ambos durante un período.

**Hook** `useAdminLogistics.ts` no requiere cambios.

---

### 4. LOGÍSTICA — Acciones encapsuladas en mobile (DropdownMenu)

En `src/pages/admin/Logistics.tsx`, columna "Acciones":
- Reemplazar la fila de 4 botones de ícono por un único `DropdownMenu` con trigger `<Settings />` (engranaje).
- Items del menú (en orden):
  1. **Ver asistentes** (`Users`) → navega a `/admin/logistics/{id}/assign`
  2. **Editar** (`Pencil`)
  3. **Cancelar servicio** (`Ban`, color amber) — oculto si ya está cancelado
  4. **Reactivar** (`RotateCcw`) — solo visible si está cancelado
  5. Separador
  6. **Eliminar** (`Trash2`, color rojo)
- Aplicar este patrón en todos los breakpoints (consistencia mobile + desktop, no solo en mobile, para evitar dos UIs distintas).
- Tooltips internos del dropdown ya no son necesarios (el label es suficiente).

Nuevas claves i18n: `logistics.actionsMenu` ("Acciones del servicio").

---

## Buenas prácticas aplicadas

- **Cero hardcoded text**: todas las cadenas pasan por i18n.
- **Backend-first**: la migración de DB y el ajuste de la vista se hacen antes de tocar UI.
- **Sin breaking changes en columnas viejas**: se agregan `starts_at`/`ends_at` y se backfillean; las viejas siguen vivas.
- **Manejo defensivo en Edge Function**: `maybeSingle()`, errores tipados, logs estructurados.
- **Mobile-first**: el dropdown de acciones reduce ancho de tabla en 360px.
- **Bug colateral detectado**: warning React "Function components cannot be given refs" en `DataTablePagination` dentro de `Reports`. Se corrige envolviendo `DataTablePagination` con `React.forwardRef` o eliminando el ref que el `Tooltip` le pasa indirectamente. Lo incluyo como fix transversal.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/migrations/...` (nuevo) | Agregar `starts_at`, `ends_at`; backfill; recrear vista `service_catalog_with_status` |
| `supabase/functions/create-provider-user/index.ts` | Error handling, logs, `maybeSingle`, paginación acotada |
| `src/services/admin-logistics.service.ts` | Tipos `starts_at`/`ends_at` |
| `src/services/admin-providers.service.ts` | Propagar `data?.error` al toast |
| `src/components/admin/logistics/ServiceModal.tsx` | Datetime-local inputs + validación |
| `src/pages/admin/Logistics.tsx` | Columna fechas + DropdownMenu de acciones |
| `src/pages/admin/Staff.tsx` | Tooltips en badges de estado/acceso |
| `src/pages/admin/Reports.tsx` | `StatCard` con tooltips + fix warning de ref en `DataTablePagination` |
| `src/components/ui/data-table-pagination.tsx` | `forwardRef` si aplica |
| `src/locales/es/admin.json`, `src/locales/en/admin.json` | Nuevas claves i18n |

## Fuera de alcance

- Eliminar columnas viejas `valid_from/valid_until/valid_day` (se hará en una migración futura una vez todos los consumidores estén migrados).
- Cambios al portal de proveedor o staff (solo admin).
- Refactor general del flujo de invitación de proveedores (solo endurecemos, no rediseñamos).

