

## Diagnóstico: Bug del "primer cambio no se aplica"

### Causa raíz (confirmada en código)

En `NewAttendeeModal.tsx` (líneas 50-99) el flujo de edición tiene una **race condition** entre el `form.reset()` del `useEffect` y el `mutate` del submit. Pero el problema **principal** está en otro lado:

**Bug #1 — `useEffect` resetea el formulario con datos viejos tras editar (NewAttendeeModal.tsx)**

```text
1. Usuario abre modal de edición → useEffect resetea form con attendee actual ✅
2. Usuario cambia "specialty" de "X" a "Y" → form interno tiene "Y"
3. Usuario hace submit → updateMutation.mutateAsync({...})
4. onSuccess invalida ['admin-attendees'] → React Query refetch
5. Query devuelve la lista NUEVA → prop `attendee` que llega al modal cambia de referencia
6. PERO: form.reset() en onSubmit corre ANTES de cerrar (línea 117)
   y onOpenChange(false) corre INMEDIATAMENTE después
7. El `useEffect` [open, attendee, form] se vuelve a disparar porque
   `attendee` cambió de referencia y `open` cambió a false → no resetea
   pero la próxima apertura usa una referencia que puede estar stale.
```

**Bug #2 — `handleSearchChange` con setTimeout dentro de useCallback (Attendees.tsx línea 42-46)**

```typescript
const handleSearchChange = useCallback((value: string) => {
  setSearch(value);
  const timer = setTimeout(() => setDebouncedSearch(value), 300);
  return () => clearTimeout(timer);  // ← este return NO hace nada, no es un useEffect cleanup
}, []);
```

El `return () => clearTimeout(timer)` **no se ejecuta nunca** — `useCallback` no lo invoca como cleanup. Cada keystroke crea un timer nuevo sin cancelar el anterior, causando múltiples `setDebouncedSearch` en cadena. Esto provoca que la query se refetch varias veces con valores intermedios — y el último resultado puede ser de un valor de búsqueda anterior, **mostrando datos viejos en la tabla**.

**Bug #3 — Falta `await refetch()` después de mutaciones (useAdminAttendees.ts)**

```typescript
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
  // ↑ no se hace await — la promise del mutation resuelve antes
  //   de que el refetch termine
}
```

`invalidateQueries` marca la query como stale pero **no espera** al refetch. El modal se cierra antes de que llegue la data nueva → la tabla muestra el snapshot viejo del cache de TanStack Query hasta el siguiente render.

**Bug #4 — Cache PWA Workbox (StaleWhileRevalidate sobre attendees)**

Confirmado en discusiones previas. En `vite.config.ts` la tabla `attendees` usa `StaleWhileRevalidate`. Tras un PATCH:
- Frontend invalida React Query → hace nuevo GET
- Service Worker intercepta el GET → devuelve cache vieja inmediatamente (1ª lectura)
- En background el SW actualiza la cache desde la red
- En la **siguiente** invalidación (2º cambio) → ahora sí devuelve datos frescos

Esto explica exactamente el síntoma de QA: "el primer cambio no aparece, el segundo sí".

---

### Plan de corrección

**1. Arreglar `NewAttendeeModal.tsx`** (foco principal)

- Capturar `attendee.id` en una variable local al montar para evitar stale closures.
- Después de submit exitoso: cerrar modal **antes** de resetear el form, usar `await mutateAsync` y luego `await refetch` antes de cerrar.
- Eliminar el `form.reset()` redundante post-submit (el `useEffect` ya maneja el reset al cambiar `open`).
- Agregar key={attendee?.id ?? 'new'} en el modal cuando se renderiza desde Attendees.tsx para forzar remount limpio entre ediciones.

**2. Arreglar `useAdminAttendees.ts`**

Cambiar el patrón `onSuccess` para **esperar** al refetch antes de resolver la mutación:

```typescript
onSuccess: async (_, variables) => {
  await queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
  await queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] });
  await queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', variables.id] });
}
```

Aplicar a `useUpdateAttendee`, `useCreateAttendee`, `useBulkCreateAttendees`, `useDeleteAttendee`, `useUpdateAttendeeStatus`.

**3. Arreglar el debounce en `Attendees.tsx`**

Reemplazar el patrón roto de `useCallback`+`setTimeout` por un `useEffect` real:

```typescript
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(search), 300);
  return () => clearTimeout(timer);
}, [search]);
```

**4. Excluir `attendees` del cache StaleWhileRevalidate de Workbox** (`vite.config.ts`)

Cambiar la estrategia de `attendees` a `NetworkFirst` con timeout corto (3s) para que siempre intente datos frescos primero. Mantiene offline support como fallback pero garantiza consistencia post-mutación.

**5. Forzar invalidación de caches del SW en mutaciones críticas**

En `useUpdateAttendee` y `useCreateAttendee`, después de `invalidateQueries`, ejecutar:

```typescript
if ('caches' in window) {
  const cache = await caches.open('supabase-attendees');
  const keys = await cache.keys();
  await Promise.all(keys.map(k => cache.delete(k)));
}
```

---

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/admin/attendees/NewAttendeeModal.tsx` | Cerrar antes de reset, await mutación, eliminar `form.reset()` redundante |
| `src/pages/admin/Attendees.tsx` | Debounce con useEffect; `key` prop en modal |
| `src/hooks/useAdminAttendees.ts` | `onSuccess` async + `await invalidateQueries` en todos los hooks de mutación |
| `vite.config.ts` | Cambiar estrategia de cache de `attendees` a NetworkFirst |

### Validación post-fix

1. En modo incógnito: editar especialidad → debe verse al instante (sin recargar)
2. En navegador habitual con SW viejo: Clear site data una vez, luego probar
3. Editar dos asistentes seguidos: ambos cambios deben verse inmediatamente
4. Crear nuevo asistente: aparece en la lista sin necesidad de "Actualizar"
5. Buscar mientras se escribe: la tabla solo debe filtrar al final del typing, no parpadear con resultados intermedios

