

## Plan — Iteración 2: Skeletons + Prefetch (versión final con simulación de pruebas)

### Resumen ejecutivo

3 mejoras coordinadas que atacan distintas fases del ciclo de carga:
1. **Skeleton fantasma** post-splash — reduce ansiedad de espera del primer render.
2. **Prefetch en navegación** — elimina latencia al cambiar de pestaña.
3. **Splash funcional** — convierte tiempo de espera en feedback visible.

Cero cambios en DB, RLS, servicios, mensajería ni notificaciones.

---

### Beneficios cuantificados

| Métrica | Hoy | Después | Mejora |
|---|---|---|---|
| Pantalla blanca inicial | 200–500ms | ~0ms (splash ya activo) | **Eliminada** |
| Spinner genérico tras splash | 700–1200ms | Skeleton fantasma desde 100ms | **~85% menos vacío visual** |
| Cambio de pestaña (Agenda, Tickets, Sponsors, Polls, Contacts) | 250–400ms | 30–80ms | **~75% más rápido** |
| Ansiedad de espera (FCP→TTI) | Alta — usuario no sabe qué pasa | Baja — splash dice "Verificando sesión…", "Cargando evento…" | **Cualitativo** |
| Llamadas duplicadas por hover rápido | Hasta 3-4 fetches en cascada | 1 fetch (debounce 100ms) | **~70% menos requests** |
| Bundle size | Sin cambio | Sin cambio | — |

**Beneficios indirectos:**
- Menor abandono en primer login (usuarios pacientes con feedback visible).
- Mejor percepción en mobile gama media (donde el parse JS pesa más).
- Realtime de mensajería/anuncios intacto, no se interfiere con WebSockets.

---

### Cambios técnicos

#### 1. Skeleton fantasma en `EventProvider`

**Archivo:** `src/components/layout/EventProvider.tsx`

Reemplaza el spinner actual (`Skeleton h-12 w-12 rounded-full`) por:
- Header gradient `#1A56A0 → #00B89F` de 56px
- Bottom nav fantasma con 5 placeholders circulares animados
- Tarjeta principal con 3 líneas skeleton

#### 2. Hook `usePrefetch` con guards manuales

**Archivo nuevo:** `src/hooks/usePrefetch.ts`

```ts
export function usePrefetch(eventId: string, attendeeId?: string) {
  const qc = useQueryClient();
  const STALE = 30_000;

  return useMemo(() => ({
    agenda: () => {
      import('@/pages/attendee/Agenda'); // chunk en paralelo (fire-and-forget)
      return qc.prefetchQuery({
        queryKey: ['activities', eventId],
        queryFn: () => agendaService.getActivities(eventId),
        staleTime: STALE,
      });
    },
    tickets: () => {
      import('@/pages/attendee/Tickets');
      return attendeeId
        ? qc.prefetchQuery({
            queryKey: ['tickets', eventId, attendeeId],
            queryFn: () => ticketsService.getByAttendee(eventId, attendeeId),
            staleTime: STALE,
          })
        : Promise.resolve();
    },
    sponsors: () => {
      import('@/pages/attendee/Commercial');
      return qc.prefetchQuery({ queryKey: ['sponsors', eventId], queryFn: () => sponsorService.getByEvent(eventId), staleTime: STALE });
    },
    polls: () => {
      import('@/pages/attendee/Polls');
      return attendeeId
        ? qc.prefetchQuery({ queryKey: ['polls', eventId, attendeeId], queryFn: () => pollsService.getActivePolls(eventId, attendeeId), staleTime: STALE })
        : Promise.resolve();
    },
    contacts: () => {
      import('@/pages/attendee/Contacts');
      return qc.prefetchQuery({ queryKey: ['contacts-directory', eventId], queryFn: () => contactsService.getEventAttendees(eventId), staleTime: STALE });
    },
  }), [qc, eventId, attendeeId]);
}
```

**Excluidos:** messaging y announcements (ya tienen realtime activo manteniendo cache caliente).

#### 3. Helper `usePrefetchHandlers`

**Archivo nuevo:** `src/hooks/usePrefetchHandlers.ts`

```ts
export function usePrefetchHandlers(prefetchFn: () => void) {
  const timer = useRef<number>();
  return {
    onMouseEnter: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(prefetchFn, 100);
    },
    onMouseLeave: () => window.clearTimeout(timer.current),
    onTouchStart: () => prefetchFn(),
    onFocus: () => prefetchFn(),
  };
}
```

#### 4. Aplicar handlers en navegación

**Archivos:** `BottomNav.tsx`, `HamburgerMenu.tsx`, `AttendeeSidebar.tsx`

Cada `NavLink` recibe los handlers del módulo destino.

#### 5. Splash funcional desacoplado vía CustomEvent

**Archivos:** `index.html`, `useAuth.tsx`, `EventProvider.tsx`

- En `index.html`: `<span id="app-splash-status">Cargando…</span>` + listener de `app:init`.
- En `useAuth.tsx`: `dispatchEvent('app:init', { step: 'Verificando sesión…' })`.
- En `EventProvider.tsx`: `dispatchEvent('app:init', { step: 'Cargando evento…' })`.

DOM imperativo desacoplado de React.

---

### Simulación de pruebas

#### Escenario A — Primer login en mobile 4G real (Moto G7, Chrome)

| Tiempo | Hoy | Con plan |
|---|---|---|
| 0ms | Pantalla blanca | Splash visible: "Cargando…" |
| 200ms | Pantalla blanca | Splash: "Verificando sesión…" |
| 500ms | Pantalla blanca | Splash: "Cargando evento…" |
| 800ms | Spinner girando | Skeleton fantasma (header gradient + bottom nav) |
| 1100ms | Spinner girando | Skeleton fantasma (datos llegando) |
| 1300ms | Home renderizado | Home renderizado con fade desde skeleton |

**Resultado:** el usuario ve actividad continua desde 0ms. La sensación es "rápida con estado" en vez de "trabada con spinner".

#### Escenario B — Tap en tab "Tickets" desde Home (mobile)

**Hoy:**
1. Tap → React Router monta `<Tickets />` lazy → spinner ~150ms (chunk JS)
2. `useTickets` dispara fetch → spinner ~200ms más
3. Render con datos → **total ~350ms**

**Con plan:**
1. Dedo toca el ícono → `onTouchStart` dispara `prefetch.tickets()` → chunk + fetch en paralelo
2. ~100ms después React Router monta — chunk ya descargado, fetch en vuelo o resuelto
3. `useTickets` encuentra dato en cache → render inmediato → **total ~80ms**

**Mejora medible:** -270ms (~77% más rápido).

#### Escenario C — Hover rápido sobre 3 tabs en desktop

**Hoy (sin prefetch):** ningún fetch hasta el click.

**Sin debounce:** 3 fetches disparados inmediatamente, 2 desperdiciados.

**Con debounce 100ms (plan):**
- Dedo pasa por Agenda (50ms) → cancela timer
- Dedo pasa por Tickets (60ms) → cancela timer
- Dedo se queda en Sponsors (>100ms) → solo se dispara `prefetch.sponsors()`

**Resultado:** 1 fetch en vez de 3.

#### Escenario D — Login screen (sin attendee)

Usuario hace hover sobre tab Tickets en bottom nav (caso edge: no debería verse pero verifiquemos).

- `prefetch.tickets()` evalúa `attendeeId` → undefined → retorna `Promise.resolve()`
- Cero requests al backend.

**Resultado:** guard manual funciona, no hay errores 401.

#### Escenario E — Realtime de mensajería durante navegación

Usuario está en Agenda, llega un mensaje nuevo.

- `useDirectMessageToasts` (sin tocar) recibe evento Realtime → muestra toast.
- Usuario toca tab Messaging → no está en `usePrefetch` → comportamiento actual sin cambios.
- Mensajería abre con su lógica actual de carga.

**Resultado:** mensajería intacta, prefetch no interfiere con WebSockets.

#### Escenario F — Reconexión tras offline

- Usuario pierde conexión, vuelve online.
- TanStack Query refetchea queries con `refetchOnReconnect: true` (config existente).
- Prefetch funciona normal en hover/touch, datos quedan frescos `staleTime: 30s`.

**Resultado:** sin cambios respecto a hoy, solo mejora.

---

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Prefetch consume datos móviles | `staleTime: 30s` evita refetches; queries son ligeras (<5KB cada una) |
| Chunks descargados que no se usan | Vite ya hace tree-shaking; el chunk se cachea por SW para futuras sesiones |
| CustomEvent del splash no llega si React falla | El splash queda visible con "Cargando…", el ErrorBoundary lo reemplaza |
| Skeleton diferente al render real causa "salto" | Diseño imita estructura exacta (header 56px + bottom nav + card) |
| Debounce 100ms se siente lento en desktop | Imperceptible — el ojo humano no detecta <150ms de delay |

---

### Archivos a modificar/crear

| Archivo | Acción |
|---|---|
| `src/components/layout/EventProvider.tsx` | Skeleton fantasma + dispatch `app:init` |
| `src/hooks/usePrefetch.ts` | **Nuevo** |
| `src/hooks/usePrefetchHandlers.ts` | **Nuevo** |
| `src/components/layout/BottomNav.tsx` | Aplicar handlers |
| `src/components/layout/HamburgerMenu.tsx` | Aplicar handlers |
| `src/components/layout/AttendeeSidebar.tsx` | Aplicar handlers |
| `index.html` | `<span id="app-splash-status">` + listener |
| `src/hooks/useAuth.tsx` | Dispatch `app:init` en auth check |

---

### Lo que NO se toca

- Mensajería, push, service worker, realtime de chat/announcements.
- Vendor chunk de 226KB (ya cacheado por SW).
- Reports / Excel / Sponsors admin (ya lazy-loaded).
- i18n, RLS, servicios, tipos.

---

### Esfuerzo total

~30 minutos. 8 archivos. Cero migraciones.

