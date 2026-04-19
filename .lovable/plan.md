

## Diagnóstico

Hay **dos problemas distintos** que se combinan:

### Problema 1 (CRÍTICO) — La imagen muestra `<select>` nativos, no el componente real
La captura que enviaste muestra dropdowns con flechitas dobles `↕` típicas de **selects nativos del navegador en macOS**, con los placeholders literales "Especialidad", "Institución", "Servicios" — **sin valores cargados**. El componente real `AttendeesFilters.tsx` es un `Popover` con buscador y multi-select, no un `<select>` nativo.

Esto significa que en ese viewport (938px CSS) **NO se está renderizando el componente desktop**. Mirando `AttendeesFilters.tsx`:

```tsx
<div className="hidden flex-wrap items-end gap-3 md:flex">  // desktop
<div className="md:hidden">                                    // mobile sheet
```

`md:` en Tailwind = ≥768px. A 938px debería verse el desktop, pero los `MultiSelect` muestran `Popover` con `Button`, no `<select>`. 

→ **La pantalla en la captura está mostrando el componente nativo `<select>` de algún build viejo cacheado, o hay otro componente sobrepuesto.** 

### Problema 2 (CONFIRMADO) — Los datos sí existen en BD
Verifiqué directo en Supabase:
- **573 asistentes** activos
- **85 especialidades distintas** (ej. `QUIMICO FARMACEUTICO`, `ASISTENTE`, `INVITADO`)
- **331 instituciones distintas** (ej. `ADIUM SAS`, `UNIVERSIDAD DE ANTIOQUIA`, `CRUZ VERDE`)

El servicio `getFilterOptions` construye correctamente el listado y el hook `useAttendeeFilterOptions` lo expone. El backend está OK.

### Problema 3 — Inconsistencia menor en el servicio
En `admin-attendees.service.ts` la columna se llama `institution` pero en algún lugar del código antiguo aparece `institutions` (plural) en filtros — el `.in('institution', filters.institutions)` usa el plural en el array de UI y singular en la columna, lo cual está correcto. ✅

---

## Plan de implementación

### Paso 1 · Forzar invalidación de caché Service Worker + recarga
El sospechoso #1 es el Service Worker PWA cacheando una versión vieja del bundle.
- Bumpear la versión del SW en `vite.config.ts` (workbox `cacheId`).
- Agregar query string `?v={timestamp}` en build para forzar revalidación.

### Paso 2 · Verificar y blindar render de `AttendeesFilters`
- Inspeccionar visualmente el DOM real con `browser--observe` en el preview para confirmar qué componente está renderizando a 938px.
- Si está cargando un fallback nativo, revisar si `Popover`/`Command` de shadcn fallaron por error JS.
- Añadir `console.warn` si `options.specialties` o `options.institutions` están vacíos cuando `isLoading=false` para detectar el problema en runtime.

### Paso 3 · Mejora UX — Mostrar contador en el trigger
- Cuando `options.specialties.length === 0` y la query terminó: mostrar el botón deshabilitado con tooltip "Sin datos".
- Cuando `isLoading`: mostrar skeleton en lugar del botón vacío.
- Asegurar que `useAttendeeFilterOptions` invalide cache cuando se importan nuevos asistentes (hoy solo invalida `admin-attendees`, no `admin-attendee-filter-options`).

### Paso 4 · Corregir invalidación tras bulk import
En `useBulkCreateAttendees` y `useCreateAttendee`, agregar:
```ts
queryClient.invalidateQueries({ queryKey: ['admin-attendee-filter-options'] });
```
Hoy se importan asistentes con nuevas especialidades/instituciones y los dropdowns no se refrescan hasta los 5 minutos de `staleTime`.

### Paso 5 · Verificación end-to-end
1. Abrir `/{event-slug}/admin/users` en navegador desktop → confirmar que aparecen los dropdowns con buscador (NO selects nativos).
2. Abrir el dropdown "Especialidad" → debe listar las 85 especialidades reales (`QUIMICO FARMACEUTICO`, `ASISTENTE`, etc.).
3. Seleccionar 1-2 → la tabla se filtra y la URL refleja `?specialties=QUIMICO%20FARMACEUTICO`.
4. Importar un CSV con una especialidad nueva → reabrir el dropdown → debe aparecer inmediatamente.

