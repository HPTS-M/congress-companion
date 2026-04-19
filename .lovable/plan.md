

El usuario pide dos cosas conectadas para el lado **asistente**:

1. **Concurrencia** — manejo cuando hay muchos usuarios simultáneos
2. **Offline UX** — banner visible cuando se cae la conexión + recuperación inmediata de mensajes y anuncios al reconectar

Reviso el estado actual:

- ✅ Existe `useOnlineStatus` hook
- ✅ Existe `OfflineBanner` en `App.tsx` que invalida queries y muestra toast al reconectar
- ✅ i18n tiene `offlineBanner.offline / reconnected / syncingTitle / syncingDescription`
- ✅ React Query con `refetchOnReconnect: true`
- ⚠️ Falta forzar re-suscripción Realtime tras reconexión (mensajes/anuncios usan Supabase Realtime, los channels mueren cuando hay desconexión larga)
- ⚠️ El banner actual solo aparece cuando `navigator.onLine = false`, no cuando hay errores de red con conexión activa
- ⚠️ No hay diferenciación visual entre "offline total" y "reconectando/sincronizando"
- ⚠️ Concurrencia: no hay debounce/throttle en mutaciones críticas (votos en polls, contactos, mensajes), lo que puede causar duplicados bajo carga

## Plan · Resiliencia offline + concurrencia para asistentes

### Parte A · Offline UX mejorado (asistente únicamente)

**A1 · Banner offline persistente y visible**
- Mover `OfflineBanner` de `App.tsx` global → wrapper exclusivo en `AttendeeLayout.tsx` (admins/staff/providers no lo ven)
- Estados visuales:
  - 🔴 **Offline**: banner rojo fijo bajo el header, no se puede cerrar, texto `offlineBanner.offline`
  - 🟡 **Reconectando**: banner ámbar con spinner, mientras refresca queries
  - 🟢 **Sincronizado**: toast verde 2s, luego desaparece
- Indicador permanente en el header (puntito junto al icono de mensajería) cuando offline

**A2 · Force-refresh agresivo al reconectar**
En el handler `online`:
1. Invalidar TODAS las queries de mensajería + anuncios + polls + contactos:
   ```ts
   queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
   queryClient.invalidateQueries({ queryKey: ['announcements'] })
   queryClient.invalidateQueries({ queryKey: ['direct-conversations'] })
   queryClient.invalidateQueries({ queryKey: ['direct-messages'] })
   queryClient.invalidateQueries({ queryKey: ['polls'] })
   ```
2. Disparar re-suscripción de Realtime channels (ver A3)

**A3 · Realtime con auto-reconexión**
- Crear hook `useRealtimeChannel(channelName, config)` que centralice el patrón
- Internamente escucha `online` event y llama `supabase.removeChannel()` + re-`subscribe()`
- Refactorizar `DirectChatView` y donde sea relevante para usarlo
- Garantiza que al volver la conexión los mensajes nuevos llegan en tiempo real sin requerir reload

**A4 · Detección de "online pero sin red real"**
- `navigator.onLine` puede ser `true` aunque Supabase esté caído
- Agregar healthcheck pasivo: si una query falla 2 veces seguidas con error de red → tratar como offline temporalmente
- Hook `useNetworkHealth` que combina `navigator.onLine` + tasa de error de queries

### Parte B · Concurrencia en acciones críticas

**B1 · Idempotencia en mutaciones que pueden duplicar**
Identificar y proteger:
- **Polls** (`usePolls` → `submitResponse`): doble tap = doble voto. Solución: deshabilitar botón mientras `isPending`, además de check server-side existente
- **Mensajes directos** (`DirectChatView` → `handleSend`): ya tiene optimistic update, pero falta dedupe por `client_id` (UUID generado en cliente) si el send se reintenta tras reconexión
- **Contactos** (`useContacts` → `sendRequest/accept`): doble click = doble request. Solución: lock optimista + key única por par de IDs
- **Check-in QR**: ya existe protección server-side (`UNIQUE(user_id, session_id)`), agregar feedback visual claro si se intenta de nuevo

**B2 · Cola de envío para mensajes offline**
- Si el usuario manda un mensaje sin conexión:
  - Guardar en `localStorage` bajo `pending_messages_${attendeeId}`
  - Mostrar el mensaje en UI con estado "🕐 Pendiente de envío"
  - Al reconectar, vaciar la cola en orden con reintentos exponenciales
  - Si falla 3 veces → marcar como "❌ Error, tocar para reintentar"

**B3 · Throttle en queries pesadas**
- `useUnreadMessages` y `useUnreadAnnouncements` ya tienen `refetchInterval: 30s` — bien
- Agregar `refetchOnWindowFocus: true` para refrescar cuando el usuario vuelve a la pestaña
- Pausar polling cuando `isOffline` para no acumular requests fallidos

### Parte C · i18n

Agregar a `src/locales/{es,en}/common.json` bajo `offlineBanner`:
```json
{
  "syncingMessages": "Sincronizando mensajes…",
  "syncingAnnouncements": "Buscando nuevos anuncios…",
  "pendingMessage": "Pendiente de envío",
  "messageError": "Error al enviar. Tocar para reintentar",
  "headerDot": "Sin conexión"
}
```

### Parte D · Verificación end-to-end

1. Login como asistente en `/ACQFH-2026`
2. DevTools → Network → "Offline" → ver banner rojo persistente bajo header + puntito en icono de mensajería
3. Intentar enviar un mensaje → aparece con estado "Pendiente"
4. Volver a "Online" → banner cambia a ámbar "Reconectando" → mensaje se envía → banner verde 2s → desaparece
5. Abrir 2 pestañas como mismo asistente, votar en una encuesta → la otra recibe update vía Realtime sin reload
6. En segundo dispositivo enviar anuncio admin → asistente offline lo recibe al reconectar sin reload

### Notas técnicas

- Solo afecta rutas bajo `/{event-slug}/*` con `AttendeeLayout` — no toca admin/staff/provider
- No requiere cambios en BD ni RLS
- Compatible con PWA + Service Worker existente (Workbox ya cachea assets, esto cubre data en vivo)
- Sin nuevas dependencias

### Preguntas antes de implementar

1. ¿Implementamos las 4 partes (A+B+C+D) o priorizamos solo A (banner + auto-refresh) que es el dolor más visible?
2. La cola de mensajes offline (B2) suma complejidad. ¿La incluimos ya o la dejamos para una iteración posterior?

