

## Plan: Mejoras módulo Asistentes + paginación transversal

### Parte A — Módulo Asistentes (admin)

**A1. Refresh instantáneo al crear asistente**
- El hook `useCreateAttendee` ya invalida `['admin-attendees']`, pero la query usa `queryKey: ['admin-attendees', eventId, search, statusFilter]`. La invalidación funciona. El problema real es percepción: el modal cierra antes de que la lista se re-renderice y no hay feedback visual.
- **Cambio**: en `NewAttendeeModal.onSubmit`, después de `mutateAsync` agregar `await queryClient.refetchQueries({ queryKey: ['admin-attendees'] })` antes de cerrar el modal, garantizando que la tabla muestre el registro inmediatamente. Mantener el toast con el código generado.
- Verificar que `getAttendees` ordena por `created_at DESC` (ya lo hace, línea 63) → el nuevo aparece arriba.

**A2. Persistencia de borrador en NewAttendeeModal (patrón SessionModal)**
- Replicar el patrón de `SessionModal`:
  - `DRAFT_KEY = (eventId) => 'attendee-draft-${eventId}-new'` en `localStorage`.
  - `useEffect` cada 2s que guarda `form.getValues()` si `form.formState.isDirty` y NO está en modo edición.
  - Al abrir modal en modo "nuevo": intenta cargar borrador antes de `reset(emptyValues)`.
  - `tryClose()`: si dirty → abre `AlertDialog` de confirmación "Descartar cambios" / "Seguir editando".
  - Al guardar exitosamente o descartar: `clearDraft()`.
  - Reemplazar `<Dialog onOpenChange={onOpenChange}>` por handler `tryClose`.
- Añadir claves i18n en `attendees.newAttendeeModal`: `discardTitle`, `discardDescription`, `keepEditing`, `discard` (es/en).

**A3. Desactivación de asistente (soft-disable, distinto a delete)**
- Usar la columna existente `registration_status = 'cancelled'` como mecanismo de desactivación. No hace falta migración nueva (la columna ya existe con valores `confirmed | pending | cancelled`).
- Reglas a aplicar en código (no DB) cuando `registration_status = 'cancelled'`:
  - **Login bloqueado**: en `verify-access-code` Edge Function añadir filtro `registration_status != 'cancelled'`.
  - **Servicios y agendamiento**: ocultar de listas operativas (check-in staff ya filtra solo `confirmed`, OK). Añadir guard en `addServiceToAttendee` que rechace si está cancelado.
  - **Credencial inválida**: el QR no debe validar — añadir check en `process_checkin` RPC.
- UI:
  - Nuevo botón "Desactivar" en `AttendeeDetailDrawer` (junto a estado), abre `AlertDialog` de confirmación.
  - Acción menú en `AttendeesTable` (3-dots o ícono `Ban`): "Desactivar" / "Reactivar".
  - Badge visual: estado `cancelled` ya muestra en rojo (`StatusBadge` línea 43). Añadir ícono 🚫.
  - Filtro pestaña "Cancelados" ya existe en `Attendees.tsx` línea 209.
- Servicio: reutilizar `updateAttendeeStatus(id, 'cancelled')`. Sin cambios nuevos.

### Parte B — Paginación transversal (10 registros por tabla)

**Componente reutilizable** `src/components/ui/data-table-pagination.tsx`:
- Recibe `currentPage`, `totalPages`, `pageSize`, `totalItems`, `onPageChange`.
- Usa los componentes `Pagination*` existentes en `src/components/ui/pagination.tsx`.
- Muestra: "Mostrando X-Y de Z" + controles ‹ 1 2 3 … N ›.

**Hook utilitario** `src/hooks/usePagination.ts`:
- Input: `items: T[]`, `pageSize: number = 10`.
- Output: `{ paginatedItems, currentPage, totalPages, setPage, totalItems }`.
- Resetea `currentPage = 1` cuando cambia el length del array filtrado (efecto controlado).

**Aplicar en TODAS las tablas/listas administrativas con > 10 registros potenciales:**

| Página | Componente tabla | Notas |
|---|---|---|
| Asistentes | `AttendeesTable` | Filtros + búsqueda → paginar resultado filtrado |
| Agenda | `Agenda.tsx` (lista de sesiones) | Por día seleccionado |
| Documentos | `Documents.tsx` | Por tipo/búsqueda |
| Sponsors | `Sponsors.tsx` | Por nivel/categoría |
| Logística | `Logistics.tsx` | Por tab/búsqueda |
| Providers | `Providers.tsx` | Por búsqueda |
| Polls | `Polls.tsx` | Por estado |
| Staff | `Staff.tsx` | Por búsqueda |
| Check-in Staff | `CheckinStaff.tsx` | Lista asistentes confirmados |
| Communications | `Communications.tsx` | Historial anuncios |
| Reports | `Reports.tsx` | Tablas de detalle |

**Patrón de aplicación**: el filtrado/búsqueda actúa primero sobre el array completo, luego `usePagination` corta a 10 ítems. Resetear página al cambiar filtros.

### Parte C — Optimización de tiempos de respuesta

1. **`React.memo`** en filas de tablas pesadas (`AttendeesTable` row → componente `AttendeeRow` memoizado por `a.id`).
2. **`useMemo`** para `displayedAttendees`, `statCards` y derivados de filtros (ya existen en algunos pages, completar donde falten).
3. **`useCallback`** para handlers pasados a tablas (evita re-render de filas memoizadas).
4. **`staleTime: 30_000`** en queries que ya casi no cambian (`getCounts`, `getExistingEmails`, `getDataQuality` ya tiene 30s).
5. **`select` columnas mínimas** en `getAttendees`: actualmente `select('*')` — limitar a columnas usadas en tabla (omite `notes`, `access_code_hash`, etc.).
6. **Batch `servicesCount`**: hoy `getAttendees` hace N queries en paralelo (una por asistente, líneas internas). Reemplazar por **un solo query** `select attendee_id, count(*) from attendee_services group by attendee_id` y mapear en cliente. Reduce N+1 a 2 queries.
7. **Lazy-load** del `AttendeeDetailDrawer` con `React.lazy` (carga solo al abrir).

### Archivos a crear / modificar

**Crear:**
- `src/components/ui/data-table-pagination.tsx`
- `src/hooks/usePagination.ts`

**Modificar:**
- `src/services/admin-attendees.service.ts` — optimizar `getAttendees` (select mínimo + batch services count) + guard en `addServiceToAttendee`.
- `src/components/admin/attendees/NewAttendeeModal.tsx` — borrador localStorage + AlertDialog descarte + refetch antes de cerrar.
- `src/components/admin/attendees/AttendeesTable.tsx` — paginación + memo de filas + acción "Desactivar/Reactivar".
- `src/components/admin/attendees/AttendeeDetailDrawer.tsx` — botón desactivar.
- `src/pages/admin/Attendees.tsx` — usar `usePagination`.
- `src/pages/admin/{Agenda,Documents,Sponsors,Logistics,Providers,Polls,Staff,CheckinStaff,Communications,Reports}.tsx` — aplicar paginación.
- `src/locales/{es,en}/admin.json` — claves `discardTitle/Description/keepEditing/discard/deactivate/reactivate/deactivateConfirm/pagination*`.
- `supabase/functions/verify-access-code/index.ts` — rechazar `registration_status = 'cancelled'`.
- `process_checkin` RPC (migración) — devolver error si attendee cancelado.

### Restricciones honradas
- Sin nuevas dependencias (Pagination ya existe, react-hook-form ya en uso).
- No cambios a `staleTime` global ni a service worker.
- Patrón de borrador idéntico al de SessionModal.
- Backend-first: la migración del RPC `process_checkin` se hace antes que UI de desactivación.
- i18n: cero strings hardcoded.
- RLS: sin cambios (el filtro `cancelled` es lógica de aplicación, no de seguridad).

### Comportamiento esperado tras los cambios
- Crear asistente → aparece en la tabla en <500ms sin necesidad de refresh manual.
- Cerrar modal con datos sin guardar → diálogo "¿Descartar cambios?".
- Reabrir modal → recupera el borrador automáticamente.
- Desactivar asistente → no puede iniciar sesión, no recibe servicios nuevos, su QR falla validación, aparece en pestaña "Cancelados".
- Todas las tablas grandes paginadas a 10 ítems con búsqueda/filtro funcional.
- Lista de asistentes con 1000+ registros: tiempo de render reducido ~60% (memo + select mínimo + batch counts).

