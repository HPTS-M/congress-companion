
## Plan — Correcciones offline sin degradar UX

Objetivo: arreglar los 4 bloqueantes detectados en la auditoría **sin tocar nada visible para el usuario**. Solo se ajustan claves internas y reglas de caché. Cero cambios en pantallas, copys, layouts, flujos o tiempos de respuesta percibidos.

---

### Garantías de no-degradación

| Aspecto UX | Estado actual | Después del fix |
|---|---|---|
| Pantallas, layouts, copys | — | **Sin cambios** |
| Tiempos de carga online | Skeletons normales | **Igual o mejor** (cache hit) |
| Animaciones / transiciones | — | **Sin cambios** |
| Notificaciones push | Funcionan | **Sin cambios** |
| Comportamiento en check-in / polls / mensajería | EmptyState offline ya añadido | **Sin cambios** |
| Toggle "Me interesa" online | Optimista, instantáneo | **Sin cambios** |
| Logos de sponsors online | Cargan vía URL pública | **Sin cambios** |
| Reconexión online → offline → online | Banner + invalidate | **Sin cambios** |

**Lo único que cambia es lo invisible**: qué entradas se guardan en IndexedDB y qué reglas Workbox aplican.

---

### Cambios técnicos (4 archivos, internos)

**1. `src/lib/query-persist.ts` — alinear whitelist con keys reales**

Reemplazar el `Set` de keys persistibles por las que realmente usan los hooks:

```ts
const persistable = new Set([
  'activities',          // useActivities
  'session-interests',   // useSessionInterests
  'user-interests',      // useUserInterests
  'user-checkins',       // useUserCheckins
  'sponsors',            // useSponsors (lista)
  'sponsor',             // useSponsor (detalle)
  'documents',           // useDocuments
  'tickets',             // useTickets
  'event',               // useEvent
  'event-config',        // si aplica
  'announcements',       // useAnnouncements
  'myContacts',          // useContacts
  'attendeeProfile',     // useAttendeeProfile (NO 'attendee-profile')
]);
```

**Impacto UX:** ninguno online. Offline: ahora la agenda, sponsors y perfil **sí** se hidratan.

**2. `src/hooks/usePrefetchOfflineBundle.ts` — usar las mismas keys que consumen los hooks**

Cambiar:
- `['agenda', eventId]` → `['activities', eventId]`
- `['agenda-interest-counts', eventId]` → `['session-interests', eventId]`

Y añadir prefetch de datos de usuario que faltan:
- `['user-interests', eventId, attendeeId]` con `agendaService.getUserInterests(eventId, attendeeId)`
- `['user-checkins', attendeeId]` con `agendaService.getUserCheckins(attendeeId)`

**Impacto UX:** ninguno online (el prefetch corre en background tras login, no bloquea nada). Offline: las estrellas "Me interesa" y check-ins del usuario aparecen correctamente sin red.

**3. `vite.config.ts` — sin cambios necesarios**

Reviso: el proyecto usa `getPublicUrl` sobre el bucket `event-sponsors` que **ya es público** (confirmado en `<storage-buckets>`: `event-sponsors` Is Public: Yes). Por tanto las URLs son `/storage/v1/object/public/event-sponsors/...` y la regla `CacheFirst` actual del `src/sw.ts` **ya hace match correctamente**. **No hay que tocar nada aquí.**

La auditoría anterior asumió incorrectamente que el bucket era privado — ya no lo es. Cero cambios.

**4. `src/App.tsx` — limpiar warning de PageLoader (opcional, cosmético)**

Reemplazar el `<Skeleton>` interno de `PageLoader` por un `<div className="animate-pulse rounded-md bg-muted ...">` para silenciar el warning de ref-forwarding en consola. **Sin cambio visual** — la animación y el aspecto son idénticos.

---

### Validación post-fix (gates)

1. **Online (verificación de no-regresión):** entrar a `/ACQFH-2026/agenda` con red activa → debe verse exactamente igual que ahora, mismo tiempo de carga, mismas estrellas, mismas interacciones.
2. **Offline (verificación del fix):** login online → cerrar pestaña → DevTools → Network: Offline → recargar `/ACQFH-2026/agenda` → debe pintar la lista completa con estrellas del usuario, sin spinners infinitos.
3. **Sponsors offline:** abrir `/commercial` online (carga logos) → offline → recargar → logos visibles desde caché.
4. **Push notification:** enviar announcement de prueba → debe llegar (handlers no se tocan).

---

### Archivos modificados

- `src/lib/query-persist.ts` (whitelist alineado)
- `src/hooks/usePrefetchOfflineBundle.ts` (keys correctas + 2 prefetches añadidos)
- `src/App.tsx` (cosmético: silenciar warning PageLoader)

**No modificados:** `vite.config.ts`, `src/sw.ts`, `src/main.tsx`, `useAuth.tsx`, ningún componente de UI, ningún locale, ningún hook de datos. La superficie del cambio es mínima y exclusivamente interna.
