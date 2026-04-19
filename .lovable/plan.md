

El usuario pide la cola de mensajes offline (Parte B2 del plan anterior, que se había dejado fuera). En la implementación actual `DirectChatView.handleSend`:

- Si está offline, el optimistic message se agrega a la lista
- Pero `messagingService.sendMessage` falla → se hace rollback → el mensaje desaparece
- El usuario pierde lo que escribió y no hay reintento al reconectar

Hay que implementar comportamiento tipo WhatsApp: el mensaje queda visible con estado "Pendiente", se persiste y se envía automáticamente al reconectar.

## Plan · Cola de mensajes offline (tipo WhatsApp)

### 1 · Almacén persistente de pendientes

Crear `src/lib/pending-messages.ts`:
- `localStorage` key: `pending_messages_v1`
- Estructura: `{ id, conversationId, senderId, content, createdAt, status: 'pending' | 'sending' | 'failed', attempts }`
- API: `enqueue()`, `markSending()`, `markFailed()`, `remove()`, `getByConversation()`, `getAll()`

Persistencia local sobrevive a reload, cierre de pestaña y reinicio del navegador.

### 2 · Hook `usePendingMessages(conversationId)`

`src/hooks/usePendingMessages.ts`:
- Lee la cola desde localStorage
- Suscribe a evento custom `pending-messages:changed` para re-render cuando cambia
- Retorna: `{ pending, enqueue, retry, remove }`

### 3 · Worker de envío `useMessageQueueWorker()`

`src/hooks/useMessageQueueWorker.ts` montado una sola vez en `AttendeeLayout`:
- Escucha `online` event y `attendee:reconnected`
- También corre un check al montar (por si quedaron mensajes de sesión anterior)
- Itera la cola: marca `sending` → llama `messagingService.sendMessage` → en éxito quita de cola e invalida queries; en error incrementa `attempts`
- Retroceso exponencial (1s, 3s, 9s) hasta 3 intentos → marca `failed`
- Procesa secuencial por conversación para preservar orden

### 4 · Modificar `DirectChatView.handleSend`

Lógica nueva:
```
1. Si offline o si la conversación está activa pero el usuario quiere garantía:
   → enqueue local + render optimista con badge "Pendiente"
   → no llamar sendMessage directamente
2. Si online:
   → intento normal; si falla por red → enqueue + badge "Pendiente"
3. Bloquear envío si la conversación está pending (igual que hoy)
```

### 5 · Render de mensajes pendientes en el chat

En el bucle de mensajes:
- Mezclar `messages` (servidor) + `pending` (local) ordenados por `created_at`
- Mensaje con `status: 'pending'` → reloj 🕐 + texto `t('pendingMessage')`
- Mensaje con `status: 'sending'` → reloj animado
- Mensaje con `status: 'failed'` → ícono ⚠️ + tap para `retry()` (texto `t('messageError')`)
- Cuando el real llega vía Realtime → el worker ya lo removió de la cola

### 6 · Indicador en lista de conversaciones

En `DirectConversationList`:
- Si una conversación tiene mensajes pendientes → mostrar badge ámbar "🕐 N pendiente(s)" junto a la última preview
- Hook `usePendingMessages()` sin filtro → contar por conversación

### 7 · i18n

Las claves ya existen en `common.json`:
- `offlineBanner.pendingMessage` → "Pendiente de envío"
- `offlineBanner.messageError` → "Error al enviar. Tocar para reintentar"

Agregar a `messaging.json` (es/en):
- `pendingCount_one` / `pendingCount_other` → "{{count}} mensaje pendiente"
- `tapToRetry` → "Tocar para reintentar"
- `sendingMessage` → "Enviando..."

### 8 · Edge cases manejados

- **Reload mientras offline**: la cola persiste en localStorage, al volver online se procesa
- **Cambiar de chat con mensaje pendiente**: el pendiente sigue en cola, se muestra al volver
- **Conversación rechazada/borrada**: el worker detecta error específico y descarta sin reintentar
- **Reintentos infinitos**: máx 3, luego estado `failed` con acción manual
- **Duplicación**: `id` cliente único + el worker remueve de cola en `onSuccess`; si el realtime trae el mismo contenido, ya hay deduplicación por temp-id en `DirectChatView`

### 9 · Verificación end-to-end

1. Login asistente, abrir un chat existente
2. DevTools → Network → Offline
3. Escribir 3 mensajes y enviar → aparecen con 🕐 "Pendiente"
4. Recargar la página estando offline → los mensajes siguen ahí
5. Network → Online → banner ámbar "Reconectando" → los 3 mensajes se envían en orden, badges desaparecen
6. Verificar en BD que llegaron los 3
7. Probar caso de error: enviar offline, simular fallo del servicio → mensaje queda en `failed` con botón reintentar

### Archivos tocados

- ➕ `src/lib/pending-messages.ts`
- ➕ `src/hooks/usePendingMessages.ts`
- ➕ `src/hooks/useMessageQueueWorker.ts`
- ✏️ `src/components/attendee/DirectChatView.tsx` (handleSend + render)
- ✏️ `src/components/attendee/DirectConversationList.tsx` (badge pendientes)
- ✏️ `src/components/layout/AttendeeLayout.tsx` (montar worker)
- ✏️ `src/locales/es/messaging.json` + `en/messaging.json`

Sin cambios en BD ni en RLS. Sin nuevas dependencias.

