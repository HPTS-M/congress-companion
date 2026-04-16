

## Plan: Mejoras Asistentes + Agenda

### Pensamiento

**Asistentes:** Solo es UI/animación. El refresh ya funciona, falta feedback visual al refetch + cambio de tab.

**Agenda:** Mezcla de cambios DB (foto ponente, archivar), UX (drag&drop, time picker, tooltips, refresh), y persistencia (auto-save / confirmación al cerrar). Drag & drop con `@dnd-kit/core` (ya común en el stack). Foto del ponente requiere bucket de Storage. Archivar = soft-delete con `archived_at`.

---

### Parte 1 — Asistentes

**1.1 Animación de refresco en `AttendeesTable.tsx`**
- Aceptar nuevo prop `isRefetching: boolean`
- Cuando `isRefetching=true`: aplicar clase `animate-pulse opacity-60` al contenedor de la tabla + overlay con `RefreshCw` rotando centrado
- Animación `fade-in` al volver a `false` para suavizar el reemplazo de filas

**1.2 Animación al cambiar de pestaña en `Attendees.tsx`**
- Envolver `<AttendeesTable>` en un wrapper con `key={statusFilter}` para forzar remount
- Aplicar clase `animate-fade-in` (ya existe en tailwind.config) al wrapper
- Pasar `isRefetching` desde el hook `useAdminAttendees` (exponerlo)

**1.3 Botón Refresh con feedback visual**
- En `Attendees.tsx`, animar el icono `RefreshCw` con `className={cn('h-4 w-4', isRefetching && 'animate-spin')}`
- Deshabilitar el botón mientras `isRefetching`

**Archivos:** `Attendees.tsx`, `AttendeesTable.tsx`, `useAdminAttendees.ts` (exponer `isRefetching`)

---

### Parte 2 — Agenda: Base de datos

**2.1 Migración `event_activities`:**
```sql
ALTER TABLE event_activities
  ADD COLUMN speaker_photo_url text,
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN sort_order integer DEFAULT 0;
```
- `speaker_photo_url`: foto del ponente (Storage signed URL key)
- `archived_at`: si no es null, sesión archivada (oculta de listas activas)
- `sort_order`: orden manual dentro del mismo día/sala para drag&drop

**2.2 Bucket de Storage `speaker-photos` (privado):**
- Migración SQL: `INSERT INTO storage.buckets (id, name, public) VALUES ('speaker-photos', 'speaker-photos', false)`
- RLS: admins del evento pueden insert/update/delete; lectura via signed URL
- Path convention: `{event_id}/{activity_id}.{ext}`

**2.3 Filtro en queries:** `getActivities` excluye `archived_at IS NOT NULL` por defecto. Nuevo método `getArchivedActivities`.

---

### Parte 3 — Agenda: Persistencia y confirmación al cerrar

**3.1 `SessionModal.tsx` — confirmar al cerrar con cambios sin guardar**
- Usar `form.formState.isDirty` para detectar cambios pendientes
- Al intentar cerrar (botón Cancelar, ESC, click fuera): si `isDirty`, abrir `AlertDialog` "¿Descartar cambios?"
- Solo cerrar tras confirmación

**3.2 Borrador local (autosave en localStorage)**
- Mientras el modal esté abierto, `useEffect` que guarda `form.watch()` en `localStorage` cada 2s con clave `agenda-draft-{eventId}-{sessionId|new}`
- Al abrir: si existe borrador y no estamos editando una sesión existente, ofrecer "Recuperar borrador"
- Al guardar exitoso: limpiar borrador

---

### Parte 4 — Agenda: Drag & Drop

**4.1 Reordenar dentro del mismo día (vertical)**
- Instalar `@dnd-kit/core` + `@dnd-kit/sortable`
- En `Agenda.tsx`, envolver `sessionsForDay` con `<DndContext>` + `<SortableContext>`
- Cada session row se vuelve sortable con handle visible (icono `GripVertical` a la izquierda)
- Al soltar: actualizar `sort_order` en BD para todas las sesiones del día afectadas

**4.2 Mover entre horarios**
- El drop calcula nuevo `start_time` basado en posición → permite reorganizar horarios visualmente
- Modal de confirmación: "¿Mover '{title}' a las {newTime}?"

**4.3 Mover entre salas (drag horizontal)**
- Vista alternativa con columnas por sala (toggle "Vista por sala")
- Drop en otra columna actualiza `location`
- Mantener vista lista actual como default

**4.4 Mutación nueva:** `useReorderSessions` que hace bulk `update` de `sort_order`/`start_time`/`location`

---

### Parte 5 — Agenda: Archivar sesiones

**5.1 Acción "Archivar" en cada row**
- Nuevo botón con icono `Archive` (lucide-react) entre Duplicar y Eliminar
- Llama a `useArchiveSession` que setea `archived_at = now()`
- Toast de confirmación con botón "Deshacer" (5s)

**5.2 Vista de archivadas**
- Tab/toggle "Archivadas" en el header de la página (badge con count)
- Al activar: muestra solo `archived_at IS NOT NULL`
- Cada row archivada muestra botón "Restaurar" (set `archived_at = null`)

---

### Parte 6 — Agenda: UX del modal

**6.1 Time picker mejorado**
- Reemplazar `<Input type="time">` nativo por componente custom con dropdown de horas en intervalos de 15min
- Opción de teclear manualmente conservada
- Visual: clock icon + texto grande + scroll selector (similar a iOS time picker simplificado)

**6.2 Foto del ponente**
- Nuevo campo en `SessionModal` debajo de `speaker_name`
- Componente: avatar circular 80px con upload via click + drag&drop
- Sube a `speaker-photos/{event_id}/{activity_id_or_temp}.{ext}` con `supabase.storage`
- Validaciones: max 2MB, tipos `image/jpeg|png|webp`
- Si ya existe: preview + botón "Cambiar" / "Eliminar"
- Guardar `speaker_photo_url` en form

**6.3 Tooltips en botones**
- Envolver cada botón de acción (Pencil, Copy, Archive, Trash2, GripVertical) con `<Tooltip>` de shadcn
- Textos i18n: `agenda.actions.edit`, `.duplicate`, `.archive`, `.delete`, `.reorder`
- Aplicar también a botones del header (Export, Import, Duplicar día, Nueva sesión)

---

### Parte 7 — Agenda: Refresco y animación

**7.1 Botón "Actualizar" en header**
- Nuevo botón con `RefreshCw` (igual estilo que en Asistentes)
- Llama `refetch()` de las 3 queries (activities, interestCounts, checkinCounts)
- Animación `animate-spin` mientras refetch

**7.2 Animación de la rejilla**
- Wrapper de `sessionsForDay` con `key={selectedDate}` + `animate-fade-in`
- Cada nueva sesión insertada: `animate-scale-in` (300ms)
- Sesión eliminada/archivada: `animate-fade-out` antes de remover (manejar con estado local breve)

**7.3 Mutaciones con `await invalidateQueries`** (consistente con fix anterior de Asistentes)
- Aplicar mismo patrón `async onSuccess + await` a todas las mutaciones de `useAdminAgenda`

---

### Archivos a modificar/crear

| Archivo | Acción |
|---|---|
| `supabase/migrations/<new>.sql` | Columnas + bucket + RLS |
| `src/services/admin-agenda.service.ts` | speaker_photo_url, archive, reorder, getArchived |
| `src/hooks/useAdminAgenda.ts` | useArchiveSession, useReorderSessions, await invalidate |
| `src/hooks/useAdminAttendees.ts` | exponer isRefetching |
| `src/pages/admin/Attendees.tsx` | animación refresh + tab key |
| `src/components/admin/attendees/AttendeesTable.tsx` | overlay refetching |
| `src/pages/admin/Agenda.tsx` | refresh btn, dnd, archived tab, animaciones |
| `src/components/admin/agenda/SessionModal.tsx` | confirm-close, draft, time picker, foto, tooltips |
| `src/components/admin/agenda/SpeakerPhotoUpload.tsx` | NUEVO componente |
| `src/components/admin/agenda/SortableSessionRow.tsx` | NUEVO wrapper sortable |
| `src/components/admin/agenda/TimePicker.tsx` | NUEVO time picker |
| `src/locales/es/admin.json` + `en/admin.json` | nuevas claves i18n |
| `package.json` | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

### Validación post-implementación

1. Asistentes: presionar Refresh → icono gira, tabla con pulse, datos actualizados
2. Asistentes: cambiar entre tabs → fade-in suave, no parpadeo
3. Agenda: cerrar modal con cambios sin guardar → diálogo confirma; al recargar la página y reabrir, recuperar borrador
4. Agenda: arrastrar sesión a otra posición → orden persiste tras recargar
5. Agenda: archivar → desaparece de lista activa, aparece en tab "Archivadas", restaurar funciona
6. Agenda: subir foto del ponente → preview, persiste, signed URL visible en detail drawer
7. Agenda: hover sobre cualquier botón → tooltip i18n correcto
8. Agenda: time picker abre dropdown 15min, también acepta input manual
9. Agenda: refresh button gira y refetch las 3 queries
10. Agenda: crear nueva sesión → aparece con animación scale-in sin necesidad de recargar

