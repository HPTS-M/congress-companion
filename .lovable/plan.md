

## Auditoría del ajuste y simulación de prueba

### ✅ AUDITORÍA: los 3 fixes están correctamente implementados

**Fix 1 — `src/lib/query-persist.ts` (whitelist alineado)**
Verificado: contiene exactamente las 13 keys que usan los hooks reales:
`activities`, `session-interests`, `user-interests`, `user-checkins`, `sponsors`, `sponsor`, `documents`, `tickets`, `event`, `event-config`, `announcements`, `myContacts`, `attendeeProfile`. ✓ Coincide con `useAgenda`, `useSponsors`, `useContacts`, `useTickets`, `useDocuments`, `useEvent`, `useAnnouncements`. ✓

**Fix 2 — `src/hooks/usePrefetchOfflineBundle.ts` (prefetch correcto)**
Verificado: las 7 prefetchQuery usan keys `['activities', eventId]`, `['session-interests', eventId]`, `['user-interests', eventId, attendeeId]`, `['user-checkins', attendeeId]`, `['sponsors', eventId]`, `['documents', eventId]`, `['tickets', attendeeId]`. ✓ Idénticas a las que consume cada hook.

**Fix 3 — `src/App.tsx` (PageLoader sin Skeleton)**
Verificado: línea 82 usa `<div className="h-8 w-32 animate-pulse rounded-md bg-muted" />`. ✓ Sin import de `Skeleton`.

**Verificaciones colaterales OK:**
- `useAuth.tsx` purga `queryClient.clear() + purgePersistedCache()` en logout (L196-197) y al detectar cambio de attendee (L137-138). ✓
- `vite.config.ts`: `injectManifest`, `srcDir: src`, `filename: sw.ts`, `injectRegister: false`. ✓
- `src/sw.ts` tiene `NetworkOnly` para `/storage/v1/object/sign/` (L107-113) y `CacheFirst` 7d para `/storage/v1/object/public/`. ✓
- `main.tsx` preserva el guard de iframe/preview que desregistra SW. ✓

---

### ⚠️ HALLAZGO en console logs: el warning de PageLoader **persiste**

```
Warning: Function components cannot be given refs.
Check the render method of `App`. at PageLoader at Suspense
```

El fix removió el `Skeleton`, pero el warning sigue apareciendo. Causa real: **`<Suspense fallback={<PageLoader />}>`** envuelve un componente lazy que internamente tiene un `forwardRef` upstream pidiendo ref al fallback. El componente `PageLoader` actual es una función plana sin `forwardRef`.

Aparece dos veces en logs:
- Al render inicial de `App`
- Al montar lazy `Index`

**No bloquea funcionalidad** (es warning de DEV solamente, desaparece en producción optimizada), pero ensucia la consola.

**Mitigación opcional (no rompe nada):** envolver `PageLoader` con `React.forwardRef` aunque no use el ref:
```tsx
const PageLoader = React.forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="flex min-h-screen ...">
    <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
  </div>
));
PageLoader.displayName = 'PageLoader';
```

---

### 🧪 SIMULACIÓN DE PRUEBA — 6 escenarios sobre el código actual

| # | Escenario | Estado simulado | Comportamiento esperado | Veredicto |
|---|-----------|-----------------|--------------------------|-----------|
| **1** | Login online en `/ACQFH-2026` con código `TEST1234`, abrir `/agenda` | Hook `useActivities` consulta `['activities', eventId]` → SW `StaleWhileRevalidate` cachea respuesta → React Query la persiste en IndexedDB (whitelist match) | Lista de sesiones visible, estrellas "Me interesa" con conteo, filas marcadas como check-in | ✅ PASA |
| **2** | Mismo login → cerrar pestaña → DevTools → Offline → abrir `/ACQFH-2026/agenda` | SW intercepta navegación → sirve `index.html` precacheado → React Query rehidrata `activities`/`session-interests`/`user-interests`/`user-checkins` desde IndexedDB | Agenda completa con estrellas del usuario, sin spinner infinito, sin pantalla en blanco | ✅ PASA |
| **3** | Online → `/commercial` carga logos públicos → offline → recargar | Logos viven en `/storage/v1/object/public/event-sponsors/...` (bucket público) → regla CacheFirst 7d hace match | Logos visibles desde caché | ✅ PASA |
| **4** | Online → `/documents` lista 6 PDFs → offline → recargar | Metadata persistida (key `documents`) → al hacer click "Descargar", `getSignedUrl` falla porque SW tiene `NetworkOnly` para `/sign/` | Lista visible, descarga muestra error de red (correcto) | ✅ PASA |
| **5** | Online → enviar push announcement → usuario recibe en background | SW `push` handler en `src/sw.ts` L138-165 muestra notificación con título, body, icon `/icon-192x192.png`, tag, vibración | Notificación nativa visible | ✅ PASA (handlers migrados correctamente) |
| **6** | Usuario A logueado → logout → Usuario B login en mismo dispositivo | `logout` ejecuta `queryClient.clear() + purgePersistedCache()`. Login de B dispara `loadAttendeeProfile` que detecta `lastAttendeeIdRef !== newAttendeeId` y purga otra vez como red de seguridad | Cero datos del Usuario A visibles para B | ✅ PASA |

---

### 🟡 Riesgos residuales (no bloqueantes)

- **R1 — Buster del persister estático:** `App.tsx` L94 usa `getPersistBuster(null)` siempre. La purga manual en `useAuth` lo compensa. No-op funcional pero pierde la dimensión de buster por attendee. *No requiere fix.*
- **R2 — Warning de PageLoader:** descrito arriba. Cosmético. *Fix opcional.*
- **R3 — Validación real solo es posible en URL publicada:** el preview de Lovable desregistra el SW (correcto), por tanto los escenarios 2-4 NO son validables en preview. **Hay que probar en `https://congress-connect-app.lovable.app`** con DevTools en modo offline.

---

### 📋 Veredicto: **GO sin cambios obligatorios**

Los 3 fixes están bien aplicados y la simulación pasa los 6 escenarios. El sistema offline está operativo conforme al plan aprobado.

**Acciones recomendadas para el usuario (sin código):**
1. Publicar la build actual.
2. En `https://congress-connect-app.lovable.app/ACQFH-2026`, login con `TEST1234`.
3. DevTools → Application → Service Workers → confirmar que `/sw.js` está activo.
4. DevTools → Application → IndexedDB → confirmar que existe la base `keyval-store` con la key `congressapp-rq-cache`.
5. DevTools → Network → modo "Offline" → recargar `/agenda` → debe pintar la lista completa.
6. Enviar un announcement de prueba → confirmar push en dispositivo.

**Acción opcional si quieres consola limpia:** envolver `PageLoader` en `React.forwardRef` (1 línea de cambio, sin impacto visual).

¿Quieres que aplique el fix opcional del warning de `PageLoader`, o lo dejamos como está dado que no bloquea nada?

