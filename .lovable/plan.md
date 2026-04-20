

## Bug fix: el badge rojo de anuncios no se limpia en móvil

### Diagnóstico

El badge de anuncios solo se limpia cuando el usuario hace click en el ícono de campana (🔔) del `AppHeader`, porque ese es el único lugar que invoca `announcements.markAsSeen()`:

```tsx
// src/components/layout/AppHeader.tsx (línea 31-34)
const handleBellClick = (): void => {
  announcements.markAsSeen();
  navigate(`/${eventSlug}/announcements`);
};
```

En **desktop** funciona porque el usuario ve el header arriba y hace click en la campana → se limpia.

En **móvil** el flujo natural es:
1. Abre el menú hamburguesa (≡) en el header.
2. Toca "Anuncios" → `HamburgerMenu.handleNavigate('/announcements')` navega directo, **sin llamar `markAsSeen()`**.
3. Llega a `/announcements`. La página renderiza la lista pero **nunca llama `markAsSeen()`** tampoco.

Resultado: el badge rojo persiste en el header aunque el usuario ya esté viendo los anuncios. Mismo bug aplica si llega vía deep link, refresh o cualquier otra ruta de entrada.

### Causa raíz (una sola)

`markAsSeen` está acoplado al click del ícono en lugar de al hecho de **ver la página de anuncios**. La fuente de verdad correcta es: "el usuario abrió `/announcements`" → marcar como visto.

### Solución

Mover (y mantener) la llamada a `markAsSeen()` al montaje de la página `/announcements`. Eso cubre los 3 caminos de entrada (campana del header, hamburguesa móvil, navegación directa por URL) con una sola línea de código.

### Cambios

**1. `src/pages/attendee/Announcements.tsx`** — agregar `useEffect` que llama `markAsSeen()` cuando hay `eventId` y los anuncios terminaron de cargar (para que `count` ya refleje el estado correcto antes de marcar):

```tsx
import { useEffect, useState } from 'react';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';

// dentro del componente:
const { markAsSeen } = useUnreadAnnouncements(eventId);

useEffect(() => {
  if (!eventId || isLoading) return;
  markAsSeen();
}, [eventId, isLoading, markAsSeen]);
```

`markAsSeen` ya está envuelto en `useCallback` con dependencias estables, así que el efecto corre una sola vez por visita a la página.

**2. `src/components/layout/AppHeader.tsx`** — sin cambios funcionales necesarios. La llamada en `handleBellClick` puede quedarse (es redundante pero inofensiva: `localStorage.setItem` con la misma key dos veces seguidas no rompe nada y sigue dando feedback inmediato al click). Lo dejamos como está para no introducir regresiones en desktop.

### No se modifica

- `useUnreadAnnouncements`: la lógica de polling, `localStorage`, query invalidation y migración desde la key legacy ya funciona correctamente.
- `HamburgerMenu`: no necesita lógica de notificaciones, solo navega.
- Backend, RLS, servicios, hooks de mensajes: fuera de alcance.

### Resultado esperado

| Escenario | Antes | Después |
|---|---|---|
| Desktop — click campana | ✅ se limpia | ✅ se limpia |
| Móvil — hamburguesa → Anuncios | ❌ persiste | ✅ se limpia |
| Cualquier dispositivo — URL directa `/announcements` | ❌ persiste | ✅ se limpia |
| Cualquier dispositivo — refresh estando en Anuncios | ❌ persiste | ✅ se limpia |

### Verificación post-deploy

1. Login asistente en `ACQFH-2026` desde móvil (viewport 375px).
2. Confirmar badge rojo visible en la campana del header (si hay anuncios sin leer).
3. Abrir hamburguesa → tocar "Anuncios".
4. Volver atrás (o ir a Inicio) → confirmar que el badge ya no aparece.
5. Repetir en desktop por regresión: click directo en campana → badge se limpia igual que antes.

