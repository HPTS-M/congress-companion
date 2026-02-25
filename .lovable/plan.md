

## Check-in Staff Module — Plan de Implementacion

### Diagnostico del estado actual

**Lo que ya existe:**
- Attendee CheckIn page (`src/pages/attendee/CheckIn.tsx`) con scanner QR funcional usando `html5-qrcode`
- `checkinService` y `useCheckin` hooks para operaciones de check-in
- Funcion RPC `process_checkin` que previene duplicados
- Formato QR: `congressapp:{event_id}:{session_id}`
- `adminAgendaService.getActivities()` para obtener sesiones
- Ruta `checkin-staff` ya registrada en sidebar del admin (`AdminLayout.tsx` navItems)
- i18n keys `admin.nav.checkinStaff` ya existen en ES/EN

**Lo que falta:**
- No existe la pagina `src/pages/admin/CheckinStaff.tsx`
- No existe ruta en `App.tsx` para `checkin-staff`
- No existe servicio dedicado para check-in staff
- No existen i18n keys para el modulo check-in staff
- Falta politica RLS: admins no pueden INSERT/SELECT en `attendee_checkins` (solo superusers y event_staff)
- `block_anon_access` en `attendee_checkins` es PERMISSIVE (deberia ser RESTRICTIVE)

---

### Paso 1: Migracion de base de datos (RLS)

Crear politica PERMISSIVE para que admins de la organizacion puedan gestionar checkins, y corregir `block_anon_access`:

```sql
-- Admin org access to attendee_checkins
CREATE POLICY "Admins manage org checkins"
ON public.attendee_checkins FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_activities act
    JOIN events e ON e.id = act.event_id
    WHERE act.id = attendee_checkins.activity_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Fix block_anon_access (currently PERMISSIVE, should be RESTRICTIVE)
DROP POLICY "block_anon_access" ON public.attendee_checkins;
CREATE POLICY "block_anon_access"
ON public.attendee_checkins AS RESTRICTIVE FOR SELECT TO anon
USING (false);
```

---

### Paso 2: Servicio backend — `src/services/admin-checkin-staff.service.ts`

Funciones:
- `getTodayActivities(eventId)` — sesiones de hoy primero, luego todas
- `getCheckinsByActivity(activityId)` — lista de attendees checked-in con nombre y hora
- `getCheckinCount(activityId)` — contador
- `getTotalAttendees(eventId)` — total confirmados
- `manualCheckin(activityId, attendeeId)` — INSERT via `process_checkin` RPC
- `searchAttendees(eventId, query)` — buscar por nombre o credential_code
- Supabase Realtime subscription helper para `attendee_checkins`

Tipado estricto:
```typescript
interface StaffCheckinRecord {
  id: string;
  attendee_id: string;
  activity_id: string;
  checked_in_at: string | null;
  attendee_name: string;
  credential_code: string;
}
```

---

### Paso 3: Hook — `src/hooks/useAdminCheckinStaff.ts`

- `useStaffActivities(eventId)` — TanStack Query
- `useActivityCheckins(activityId)` — TanStack Query + Supabase Realtime invalidation
- `useStaffManualCheckin()` — mutation
- `useAttendeeSearch(eventId, query)` — debounced search

---

### Paso 4: Pagina — `src/pages/admin/CheckinStaff.tsx`

Layout responsive con dos paneles:

```text
┌─────────────────────────────────────────────────┐
│  Check-in Staff                                 │
│  Validación de asistencia por sesión            │
│                                                 │
│  [Seleccionar sesión...              ▼]         │
├────────────────────┬────────────────────────────┤
│  Escanear QR       │  Asistentes registrados    │
│                    │                            │
│  ┌──────────────┐  │  12 / 45 asistentes        │
│  │              │  │  [🔍 Buscar...]            │
│  │   QR Scan    │  │                            │
│  │   280x280    │  │  ● Juan García    09:15    │
│  │              │  │  ● María López    09:18    │
│  │              │  │  ● Pedro Ruiz     09:22    │
│  └──────────────┘  │                            │
│                    │  [+ Agregar manualmente]    │
│  [Activar cámara]  │                            │
├────────────────────┴────────────────────────────┤
│  Sesión: Conferencia AI │ Check-ins: 12 │       │
│  Última: Pedro Ruiz hace 3 min                  │
│                    [⛶ Pantalla completa]        │
└─────────────────────────────────────────────────┘
```

Componentes internos:
- `SessionSelector` — dropdown con sesiones agrupadas (hoy primero)
- `QrScanPanel` — reutiliza logica de `html5-qrcode`, valida formato y sesion seleccionada
- `CheckedInList` — lista live con Realtime, search, avatar+nombre+hora
- `ManualCheckinDialog` — modal de busqueda de attendee para check-in manual
- `StatsBar` — barra inferior con metricas
- `FullscreenToggle` — usa `document.documentElement.requestFullscreen()`

Flash animations:
- Verde (exito): `animate-pulse` + borde verde temporal
- Amarillo (duplicado): borde amarillo temporal
- Rojo (error): borde rojo temporal

---

### Paso 5: Ruta en App.tsx

```typescript
const AdminCheckinStaff = lazy(() => import('@/pages/admin/CheckinStaff'));
// Inside admin routes:
<Route path="checkin-staff" element={<AdminCheckinStaff />} />
```

---

### Paso 6: i18n keys

Agregar namespace `admin.checkinStaff` en `es/admin.json` y `en/admin.json`:

**ES:** titulo, subtitulo, selectSession, scanQr, activateCamera, stopCamera, attendeesRegistered, of, searchAttendee, addManually, manualCheckinTitle, searchByNameOrCode, confirmCheckin, accessGranted, alreadyRegistered, wrongSession, invalidQr, selectedSession, checkins, lastEntry, ago, fullscreen, exitFullscreen, noSessionSelected, selectSessionFirst, noCheckinsYet

**EN:** equivalentes en ingles

---

### Paso 7: Modo pantalla completa

Estado `isFullscreen` que:
- Llama `document.documentElement.requestFullscreen()`
- Oculta sidebar admin (CSS: `.peer-data-[state=expanded]` o estado en context)
- Muestra solo scanner + contador en layout simplificado
- Boton "Salir" para `document.exitFullscreen()`

---

### Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `supabase/migrations/XXXX_admin_checkins_rls.sql` | Nueva migracion RLS |
| `src/services/admin-checkin-staff.service.ts` | Nuevo servicio |
| `src/hooks/useAdminCheckinStaff.ts` | Nuevo hook |
| `src/pages/admin/CheckinStaff.tsx` | Nueva pagina |
| `src/App.tsx` | Agregar ruta lazy |
| `src/locales/es/admin.json` | Agregar keys checkinStaff |
| `src/locales/en/admin.json` | Agregar keys checkinStaff |

### Orden de ejecucion (backend-first)

1. Migracion RLS
2. Servicio con tipos
3. Hook
4. i18n keys (ES + EN)
5. Pagina + ruta
6. Verificacion

