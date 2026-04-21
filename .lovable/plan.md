

# Plan: Push de Mensajes Directos (C) + Métrica de Alcance Push (E)

Aprovechamos la infraestructura Web Push ya validada en producción para añadir dos features de alto impacto. **Único permiso del navegador, todo o nada** para mantener UX simple (mismo opt-in que ya existe).

---

## ✅ Lo que ya tenemos (no se toca)

| Pieza | Estado |
|---|---|
| Service Worker `public/sw.js` con `push` + `notificationclick` | ✅ Funciona |
| `usePushSubscription` (idempotente, `pushsubscriptionchange`) | ✅ Funciona |
| Tabla `push_subscriptions` (UNIQUE `user_id, event_id`) | ✅ Existe |
| `EnableNotificationsBanner` con opt-in explícito | ✅ Funciona |
| Edge function `send-announcement-push` (cleanup 404/410) | ✅ Funciona y validada |
| Realtime de mensajes en `DirectChatView` | ✅ Funciona |
| Hook `useAnnouncementToasts` (toast in-app) | ✅ Patrón a replicar |
| VAPID keys + `VAPID_SUBJECT` configuradas | ✅ Listo |

---

## 🆕 Lo que falta — Feature C: Push de mensajes directos

### Comportamiento producto
- Solo notifica al **destinatario**, nunca al emisor.
- Solo en conversaciones `status = 'active'` (no en invitaciones `pending` — eso ya genera badge).
- **Suprime** notificación nativa Y toast in-app si el destinatario tiene esa conversación abierta en ese momento (evita duplicación con el realtime existente).
- Tap en notificación → abre `/{event-slug}/messaging` (la lista). En v1 no auto-selecciona la conversación porque `Messaging.tsx` mantiene el estado en local — añadir deeplink `?c={id}` queda para futura iteración.
- Agrupación: usar `tag: dm-{conversationId}` → mensajes nuevos de la misma conversación reemplazan al anterior, no apilan.

### Backend

**Nueva Edge Function `send-message-push`** (`verify_jwt = false`, mismo patrón que `send-announcement-push`):
- Input Zod: `{ message_id: uuid }`
- Lee mensaje + conversación + emisor (nombre desde `attendees`)
- Resuelve `recipient_attendee_id` = el `initiated_by` o `participant_id` que NO es el sender
- Resuelve `recipient_user_id` desde `attendees.user_id`
- Lee solo `push_subscriptions WHERE user_id = recipient_user_id AND event_id = conv.event_id`
- Payload: `{ title: senderName, body: content.slice(0,140), url: /{event_code}/messaging, tag: dm-{conversationId} }`
- Reusa el bloque de cleanup 404/410

**Sin cambios de DB**: ya existe todo (`chat_messages`, `chat_conversations`, `attendees.user_id`, `push_subscriptions`).

### Frontend

**`src/services/messaging.service.ts`** — modificar `sendMessage()`:
- Tras el `insert` exitoso, hacer `.select('id').single()` para obtener el id real
- Llamar `supabase.functions.invoke('send-message-push', { body: { message_id } })` fire-and-forget con `.catch(console.warn)` (no bloquea el envío)

**Nuevo hook `src/hooks/useDirectMessageToasts.ts`** (paralelo a `useAnnouncementToasts`):
- Suscripción Realtime a `chat_messages` filtrada por `event_id` (vía join con `chat_conversations`) — en realidad escuchamos sin filtro y filtramos en cliente por conversaciones del usuario
- Estrategia más limpia: suscribirse a `chat_conversations WHERE event_id=eq.{eventId}` UPDATE (ya hay `last_message_at` updates), o suscribirse a `chat_messages` y filtrar por las conversaciones que aparecen en el cache de `useDirectConversations`
- **Decisión**: suscripción a `chat_messages` sin filtro por evento (no soportado server-side fácilmente), filtrar en el handler:
  - Ignorar si `sender_id === attendeeId`
  - Ignorar si la conversación no pertenece al usuario actual (chequear cache `['direct-conversations']`)
  - Ignorar si el usuario está en `/{slug}/messaging` Y `selectedDirect.id === conversation_id` (necesita un canal compartido — usar un evento `window.dispatchEvent('dm:opened', {id})` desde `DirectChatView` y un Set en el hook)
  - Si pasa todos los filtros → `toast(senderName, { description: content.slice(0,120), action: 'Ver' → navigate(/messaging) })`

**`src/components/layout/AttendeeLayout.tsx`** — montar `useDirectMessageToasts()` junto a los otros hooks.

**`src/components/attendee/DirectChatView.tsx`** — al montar/desmontar, disparar `window.dispatchEvent(new CustomEvent('dm:opened', { detail: conversation.id }))` y `'dm:closed'`. Permite al hook saber qué conv está abierta.

**i18n** (`src/locales/{es,en}/messaging.json`):
- `toast.viewAction`: "Ver" / "View"
- (título y body vienen del mensaje real, no se traducen)

---

## 🆕 Lo que falta — Feature E: Métrica de alcance push (Admin)

### Backend
**Sin cambios**. Query directo a `push_subscriptions` filtrado por `event_id`, contando filas únicas (la tabla ya tiene UNIQUE `user_id, event_id`, así que `count(*)` = attendees únicos con al menos un dispositivo).

### Frontend

**Nuevo hook `src/hooks/useAdminPushReachStats.ts`**:
```ts
{ activeCount, totalConfirmed, percentage }
```
- `activeCount`: `count(*) from push_subscriptions where event_id = X`
- `totalConfirmed`: reusar `adminCommunicationsService.getConfirmedAttendeesCount()`
- TanStack Query con `staleTime: 60_000`

**`src/pages/admin/Communications.tsx`**:
- Cambiar grid de `md:grid-cols-3` → `md:grid-cols-4`
- Nueva 4ª `StatCard` "Alcance push": valor `127 / 340 (37%)`, ícono `BellRing`

**`src/components/admin/communications/AnnouncementModal.tsx`**:
- Bajo el radio "Enviar ahora", mostrar nota informativa pequeña con el `activeCount`:
  > 🔔 *Llegará como notificación a ~127 dispositivos. El resto verá el anuncio al abrir la app.*
- Solo visible cuando modo = `now`, no en `scheduled`

**i18n** (`src/locales/{es,en}/admin.json`):
- `communications.stats.pushReach` → "Alcance push"
- `communications.stats.pushReachSub` → "con notificaciones activas"
- `communications.modal.reachInfo` → "Llegará como notificación a ~{{count}} dispositivos. El resto verá el anuncio al abrir la app."

---

## 🔒 Seguridad y privacidad

- `send-message-push` valida que el `message_id` exista y solo envía a `user_id` del destinatario real (no leak cross-user).
- No se loggea contenido del mensaje en logs del servidor.
- Función usa `SERVICE_ROLE_KEY` solo para leer las subscripciones del destinatario específico.
- Cleanup automático de subscripciones expiradas (mismo patrón que anuncios).
- Ningún cambio en RLS necesario (las queries van por service role en Edge Function).

---

## 📋 Archivos afectados

```
NEW   supabase/functions/send-message-push/index.ts
NEW   src/hooks/useDirectMessageToasts.ts
NEW   src/hooks/useAdminPushReachStats.ts

EDIT  supabase/config.toml                                  (registrar verify_jwt=false)
EDIT  src/services/messaging.service.ts                     (invoke push tras send)
EDIT  src/components/attendee/DirectChatView.tsx            (dispatch events open/close)
EDIT  src/components/layout/AttendeeLayout.tsx              (mount hook toasts DM)
EDIT  src/pages/admin/Communications.tsx                    (4ª StatCard)
EDIT  src/components/admin/communications/AnnouncementModal.tsx (nota alcance)
EDIT  src/locales/es/messaging.json                         (toast.viewAction)
EDIT  src/locales/en/messaging.json                         (toast.viewAction)
EDIT  src/locales/es/admin.json                             (3 keys nuevas)
EDIT  src/locales/en/admin.json                             (3 keys nuevas)
```

**Total: 3 nuevos + 8 editados**. ~50 minutos de implementación.

---

## ✅ Plan de prueba (pestaña real, NO preview)

1. **Push DM funciona**: TEST1234 envía mensaje a TEST5678 (con app cerrada) → notificación nativa con nombre + preview → tap abre `/messaging`.
2. **No-duplicación**: TEST5678 con conversación abierta → mensaje llega → solo refresco UI realtime, sin notificación nativa ni toast.
3. **Toast in-app**: TEST5678 en `/agenda` → mensaje llega → toast "Juan: hola..." con botón "Ver".
4. **Agrupación tag**: 3 mensajes consecutivos de la misma conv → solo se ve la última notificación.
5. **No notifica al emisor**: TEST1234 no recibe push de su propio mensaje.
6. **Métrica admin**: `/admin/communications` muestra `X / Y (Z%)` consistente con DB.
7. **Nota modal**: "Nuevo anuncio" → "Enviar ahora" → ve la nota; cambia a "Programar" → desaparece.
8. **Logs función**: 0 errors en `send-message-push` tras 5 envíos.

---

## 🚫 Lo que NO incluye este plan (futuro)

- **D) Recordatorios "tu sesión empieza en 15 min"**: requiere cron adicional + lógica de scheduling. Lo dejamos para cuando tengas fecha de evento confirmada.
- Deeplink `/messaging?c={id}` para auto-abrir la conversación desde la notificación: requiere refactor de `Messaging.tsx` para leer query param. Iteración menor posterior.
- Toggles separados anuncios/mensajes en Perfil: descartado en esta iteración por tu decisión "todo o nada".
- Notificación de solicitudes de contacto nuevas: trivial de añadir después con el mismo patrón si lo pides.

