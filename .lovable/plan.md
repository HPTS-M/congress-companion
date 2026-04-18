

## Plan: Paginación universal + Scrollbar branded + Sincronización Agenda

### Parte A — Paginación en todas las tablas admin

Aplicar el patrón ya existente (`usePagination` + `DataTablePagination`) a las 9 páginas admin pendientes. El filtrado/búsqueda actúa primero sobre el array completo, luego se pagina a 10 ítems. Resetea página al cambiar filtros.

| Página | Array fuente a paginar |
|---|---|
| Documents | `filteredDocuments` |
| Sponsors | `filtered` (sponsors) |
| Logistics | `filtered` (services por tab+search) |
| Providers | `filtered` (providers) |
| Polls | `polls` (filtrados por tab) |
| Staff | `filteredStaff` |
| CheckinStaff | lista de asistentes confirmados |
| Communications | lista de anuncios + lista de mensajes chat |
| Reports | tablas de detalle (attendance, ratings, sponsors, logistics) |

Patrón aplicado en cada página:
```tsx
const { paginatedItems, currentPage, totalPages, setPage, startIndex, endIndex, totalItems } = usePagination(filtered, 10);
// Render <Table> con paginatedItems en lugar de filtered
<DataTablePagination ... />
```

### Parte B — Scrollbar branded para tablas con overflow horizontal

**Problema:** las tablas usan `<Table>` (de shadcn) que ya envuelve en `<div className="relative w-full overflow-auto">`. En desktop angosto (1091px) aparece scroll horizontal con el scrollbar gris nativo.

**Solución:** crear utilidades CSS globales en `src/index.css` para estilizar la scrollbar con los colores del proyecto (`#1A56A0` track translúcido, thumb teal `#00B89F`), tanto en WebKit como Firefox, con soporte dark mode.

```css
/* src/index.css — nuevas utilidades */
@layer utilities {
  .scrollbar-branded {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--accent)) transparent;
  }
  .scrollbar-branded::-webkit-scrollbar { height: 8px; width: 8px; }
  .scrollbar-branded::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
  .scrollbar-branded::-webkit-scrollbar-thumb {
    background: hsl(var(--primary) / 0.4);
    border-radius: 4px;
  }
  .scrollbar-branded::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--accent));
  }
}
```

Aplicar la clase en `src/components/ui/table.tsx` (modificación mínima al wrapper):
```tsx
<div className="relative w-full overflow-auto scrollbar-branded">
```

Esto aplica automáticamente a TODAS las tablas del proyecto sin tocar cada página. También se añade a contenedores con scroll horizontal manual (mobile cards en `AttendeesTable`, listas de chats, etc).

### Parte C — Sincronización Agenda → módulos dependientes

**Diagnóstico actual:** `useAdminAgenda` ya invalida `['admin-activities', eventId]` y demás queries internas de agenda al crear/editar/eliminar. Pero los módulos consumidores usan **otras queryKeys** que no se invalidan:

| Módulo | Hook / queryKey actual | Estado |
|---|---|---|
| Polls (associate session) | `useAdminPolls` lee `event_activities` para dropdown de "session_id" | ❌ no invalida |
| Communications (announcements) | `useAdminCommsStats` y `useAdminAnnouncements` no dependen de agenda | ✓ OK |
| Ratings admin | lee sesiones para listar | ❌ revisar |
| Reports | `useAdminReports` agrega por sesión | ❌ no invalida al editar agenda |
| Attendee Agenda | `useActivities` (hook attendee) — queryKey `['activities', eventId]` | ❌ key distinta a admin |
| Attendee Polls | dropdown de sesión | ❌ |
| Attendee Ratings | filtra por sesiones pasadas | ❌ |
| Check-in Staff | lista de actividades para validar | ❌ |
| Attendee Documents | filtro por sesión asociada | ❌ |

**Solución:** centralizar la invalidación en un helper compartido y llamarlo desde todas las mutations de agenda (admin Y duplicate day). El helper invalida TODA queryKey que pueda contener datos de sesiones:

```ts
// src/hooks/useAdminAgenda.ts (modificar invalidateAgenda)
async function invalidateAgenda(qc, eventId) {
  await Promise.all([
    // Admin agenda
    qc.invalidateQueries({ queryKey: ['admin-activities', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-archived-activities', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-interest-counts', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-checkin-counts', eventId] }),
    // Attendee-side
    qc.invalidateQueries({ queryKey: ['activities', eventId] }),
    qc.invalidateQueries({ queryKey: ['session-interests', eventId] }),
    qc.invalidateQueries({ queryKey: ['user-checkins'] }),
    // Otros módulos que dependen de sesiones
    qc.invalidateQueries({ queryKey: ['admin-polls', eventId] }),
    qc.invalidateQueries({ queryKey: ['polls', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-reports', eventId] }),
    qc.invalidateQueries({ queryKey: ['ratings'] }),
    qc.invalidateQueries({ queryKey: ['admin-checkin-staff', eventId] }),
    qc.invalidateQueries({ queryKey: ['documents', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-documents', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-dashboard', eventId] }),
  ]);
}
```

(Inspeccionaré los queryKeys exactos antes de implementar para no romper nada — los nombres listados se confirmarán contra cada hook.)

**Bonus realtime:** suscribir un canal global Supabase Realtime a `event_activities` filtrado por `event_id` en un hook `useAgendaRealtime(eventId)` montado en el `EventProvider`, que invalide las mismas keys cuando otro admin/dispositivo edite la agenda. Cumple `realtime-cleanup-pattern` (cleanup en useEffect).

### Archivos a modificar

**Crear:** ninguno nuevo (paginación y componente ya existen).

**Modificar:**
- `src/index.css` — utilidad `.scrollbar-branded`.
- `src/components/ui/table.tsx` — añadir clase al wrapper.
- `src/components/layout/EventProvider.tsx` — montar `useAgendaRealtime`.
- `src/hooks/useAdminAgenda.ts` — ampliar `invalidateAgenda` + nuevo `useAgendaRealtime`.
- `src/pages/admin/Documents.tsx`
- `src/pages/admin/Sponsors.tsx`
- `src/pages/admin/Logistics.tsx`
- `src/pages/admin/Providers.tsx`
- `src/pages/admin/Polls.tsx`
- `src/pages/admin/Staff.tsx`
- `src/pages/admin/CheckinStaff.tsx`
- `src/pages/admin/Communications.tsx`
- `src/pages/admin/Reports.tsx`

### Restricciones honradas
- Sin nuevas dependencias.
- i18n: claves de paginación ya existen (`common.pagination.*`).
- `realtime-cleanup-pattern`: cleanup explícito de canal.
- Patrón de invalidación conservador: `invalidateQueries` (no `removeQueries`) — preserva caché y dispara refetch suave.
- Mobile-first preservado.
- Sin cambios a RLS ni esquema DB.

### Resultado esperado
- Todas las tablas admin paginadas a 10 ítems, con buscador/filtros que actúan antes de paginar.
- Scrollbar horizontal con colores del proyecto (azul translúcido / teal hover) en light y dark.
- Crear/editar/eliminar/archivar/restaurar/duplicar una sesión actualiza al instante: dropdowns de Polls, Reports, Check-in Staff, vista Agenda del asistente, Ratings, Documents, Dashboard. Sin necesidad de F5.
- Cambios desde otro dispositivo se reflejan vía realtime en <2s.

