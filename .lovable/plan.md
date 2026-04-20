

## Plan: Mobile-first — Sincronización de configuración + accesos a Chat visibles

### Diagnóstico

**Problema 1 — QR sigue visible aunque está deshabilitado:**
El setting `qr_enabled: false` está correcto en BD. El hook oculta el QR correctamente. **La causa real es caché**: `useEventLoader` tiene `staleTime: 10 * 60 * 1000` (10 min), por lo que el móvil sigue viendo la versión vieja hasta que expire o haya hard-refresh.

**Problema 2 — No se ven los iconos de chat en móvil:**
Mensajería, Anuncios y Contactos están escondidos dentro del menú hamburguesa (≡). En móvil no son descubribles. La barra inferior tiene 6 slots; cuando QR=off, "Check-in" desaparece y queda un slot libre que hoy no se aprovecha.

---

### Mejores prácticas mobile-first aplicadas

1. **Touch target mínimo 44×44 px** (Apple HIG / Material) — los tabs y badges deben respetarlo.
2. **Thumb-zone navigation** — acciones críticas (chat, anuncios) en barra inferior, no en menú lateral.
3. **Visibilidad de notificaciones a un vistazo** — badges siempre visibles sin abrir menús.
4. **Sincronización oportuna sin polling agresivo** — combinar caché corto + realtime + refetch on focus, en vez de polling constante (consume batería/datos).
5. **Reducir taps para acciones frecuentes** — chat y anuncios deben estar a 1 tap, no a 2 (≡ → item).
6. **Safe area insets** — la barra inferior debe respetar `env(safe-area-inset-bottom)` (iPhone notch/home indicator). Verificar que ya esté aplicado.
7. **Network-aware** — gating con `useOnlineStatus` para no abrir canales realtime offline (ya implementado en el hook existente).
8. **Estados de carga no bloqueantes** — al refrescar el evento por realtime, no mostrar skeleton de pantalla completa; solo actualizar contenido in-place.
9. **Badges legibles a 360 px** — números de no-leídos con cap visual (`9+`) y contraste accesible (WCAG AA).
10. **Sin hover-only affordances** — todo debe ser táctil; los tooltips desktop no aplican en móvil.

---

### Cambios

**1. Sincronización inmediata de la configuración del evento** — `src/hooks/useEvent.ts` + `src/components/layout/EventProvider.tsx`

- En `useEventLoader`: bajar `staleTime` de 10 min → **60 s**, añadir `refetchOnWindowFocus: true` y `refetchOnReconnect: 'always'`. Network-aware: TanStack Query no refetchea offline.
- En `EventProvider`: suscribirse vía `useRealtimeInvalidate` a `events` filtrado por `id=eq.{eventId}`, evento `UPDATE`, invalidando `['event', eventSlug]`. Garantiza propagación instantánea (<1 s) cuando admin cambia un toggle, sin requerir refresh manual del attendee.
- Cleanup automático al desmontar (ya implementado en el hook compartido).

**2. Bottom Nav dinámica con priorización mobile-first** — `src/components/layout/BottomNav.tsx`

- Mantener máximo **5 tabs visibles en móvil** (no 6) para asegurar touch targets cómodos en 360 px de ancho. Cada tab tendrá ~72 px ancho mínimo.
- Lista de candidatos en orden de prioridad (los primeros 5 habilitados se muestran):
  1. `home` (siempre)
  2. `agenda` (siempre)
  3. `messaging` (si `messagingEnabled`) ← **nueva prioridad alta**
  4. `checkin` (si `qrEnabled`)
  5. `tickets` (si `ticketsEnabled`)
  6. `commercial` (si `commercialEnabled`)
  7. `polls` (si `pollsEnabled`)
  8. `announcements` (si `announcementsEnabled`)
- Resultado para este evento (qr=off): **Inicio, Agenda, Mensajería, Tickets, Comercial**. Encuestas y Anuncios quedan en el menú ≡ con badge agregado.
- Touch targets: cada tab `min-h-[56px]`, ícono 24 px, label 11 px, padding vertical generoso.
- Safe area: `pb-[env(safe-area-inset-bottom)]` para iPhone con home indicator.

**3. Badge de no-leídos en la pestaña Mensajería** — `src/components/layout/BottomNav.tsx`

- Importar `useUnreadMessages(event.id)`.
- Renderizar pequeño dot rojo (8×8 px) en esquina superior derecha del ícono cuando `count > 0`. Si `count > 0`, opcionalmente mostrar número con cap `9+` para legibilidad.
- Color de alta visibilidad sin chocar con el primario: `bg-red-500 text-white`. Borde blanco/dark para destacar sobre cualquier fondo.
- Accesibilidad: `aria-label="X mensajes no leídos"` para lectores de pantalla.

**4. Badge agregado en el ícono ≡ del header** — `src/components/layout/AppHeader.tsx`

- Sumar `useUnreadMessages` (cuando mensajería NO esté en bottom nav) + `useUnreadAnnouncements` (cuando anuncios NO esté en bottom nav). Lógica condicional para evitar doble badge.
- Si total > 0, mostrar dot rojo sobre el ícono ≡. Indica al usuario "hay algo nuevo en el menú" sin tener que abrirlo.
- Tamaño y contraste accesibles. Touch target del botón hamburguesa permanece ≥44×44 px.

**5. Sin cambios en**

- BD, RLS, edge functions.
- Layout desktop (`md:` y arriba) — el sidebar lateral conserva todos los items y la bottom nav ya está oculta con `md:hidden`.
- Hamburguesa en sí — sigue listando todos los módulos habilitados como respaldo / overflow.

---

### Detalles técnicos

- `useEvent.ts`: ajustar opciones de la query — `staleTime: 60_000`, `refetchOnWindowFocus: true`, `refetchOnReconnect: 'always'`. Sin cambios en la firma pública del hook.
- `EventProvider.tsx`: añadir `useRealtimeInvalidate({ channelName: 'event-${event.id}', table: 'events', filter: 'id=eq.${event.id}', event: 'UPDATE', queryKeys: [['event', eventSlug]], enabled: !!event && online })`.
- `BottomNav.tsx`: refactor del array `tabs` a una construcción dinámica priorizada. Mantener `md:hidden` del nav. Aplicar `pb-[env(safe-area-inset-bottom)]`.
- `AppHeader.tsx`: importar ambos hooks de unread, calcular `hiddenUnreadTotal` excluyendo módulos ya visibles en bottom nav, renderizar dot condicional sobre el botón ≡.
- TS estricto: tipar correctamente `SettingsKey` ampliado para incluir `messagingEnabled`, `announcementsEnabled`, `contactsEnabled` ya disponibles en `useEventSettings`.
- i18n: las claves `nav.messaging`, `nav.announcements` ya existen en `common.json` (verificar y añadir si falta en `es`/`en`).
- Sin nuevos paquetes npm.

### Verificación post-deploy (mobile-first)

1. **Móvil 360 px (Chrome Android, Safari iOS)**: bottom nav muestra exactamente 5 tabs sin scroll horizontal; touch targets cómodos.
2. **Toggle QR off en admin**: en <60 s (o instantáneo por realtime) el móvil del attendee oculta el QR de `MyProfile` y la pestaña Check-in desaparece, reemplazada por Mensajería.
3. **Mensaje nuevo entrante**: aparece dot rojo sobre el ícono Mensajería en la bottom nav móvil. Al tocarlo, navega y se marca como leído.
4. **Anuncio nuevo entrante (cuando Anuncios NO está en bottom nav)**: aparece dot rojo sobre el ícono ≡ del header.
5. **Safe area iPhone con notch/home indicator**: la bottom nav respeta el inset inferior; ningún tab queda tapado.
6. **Lectores de pantalla**: `aria-label` correcto en badges de notificación.
7. **Desktop (≥768 px)**: sidebar y header sin cambios visuales; bottom nav permanece oculto.

