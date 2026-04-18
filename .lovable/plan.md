

## Plan: Mensajería en tiempo real

### Diagnóstico

Confirmado por inspección de DB y código:

1. **`chat_messages` SÍ está en `supabase_realtime`** (publicación correcta) y tiene `REPLICA IDENTITY FULL` (`relreplident = f`). El INSERT debería propagarse.
2. **`chat_conversations` está en la publicación pero con `REPLICA IDENTITY DEFAULT`** (`relreplident = d`) — los UPDATEs (last_message_at, status pending→active) no envían `OLD` completo, lo que limita el realtime de la lista.
3. **Suscripción realtime sólo se activa si `conversation.status === 'active'`** (línea 78 de `DirectChatView.tsx`). Si la conversación está `pending`, los mensajes nunca llegan en vivo — pero como el input está bloqueado en pending, no es el bug actual.
4. **La lista de conversaciones (`DirectConversationList`) NO tiene realtime**. Las invitaciones nuevas, aceptaciones y nuevos mensajes no aparecen sin recargar.
5. **El mensaje propio recién enviado** se inserta en BD pero no se agrega optimistamente a la cache → solo se ve cuando el evento realtime regresa el INSERT. Si realtime tarda o falla, el usuario ve el campo limpiarse y nada más.
6. **No hay invalidación de la lista** cuando llega un mensaje → el preview "última actividad" en la lista de conversaciones queda obsoleto.

### Causa raíz más probable del síntoma reportado
El realtime de `chat_messages` funciona, pero:
- **El receptor** sólo recibe el mensaje si tiene la conversación abierta (la suscripción está dentro de `DirectChatView`). Si está en la lista, no se entera.
- **El emisor** no ve su propio mensaje al instante (no hay update optimista) — depende del round-trip realtime.
- Cuando un usuario abre la conversación por primera vez tras aceptar, los mensajes previos no aparecen porque la query estuvo `enabled: false` mientras estaba pending.

### Cambios

**1. `src/components/attendee/DirectChatView.tsx`**
- Update optimista en `handleSend`: agregar el mensaje a la cache antes de enviarlo (con id temporal). Si falla, removerlo. El INSERT realtime confirmará/reemplazará gracias al dedupe por `id`.
- Quitar el filtro `conversation.status === 'active'` de la suscripción realtime (suscribir siempre que haya `conversation.id`), para que llegue el primer mensaje tras aceptar sin recargar.
- Al recibir un INSERT realtime, también invalidar `['direct-conversations']` para refrescar la lista (preview + orden).

**2. `src/components/attendee/DirectConversationList.tsx`**
- Agregar `useEffect` con suscripción realtime a `chat_conversations` filtrada por `event_id` para detectar:
  - Nuevas invitaciones recibidas (INSERT con `participant_id = miId`)
  - Aceptación de mis invitaciones enviadas (UPDATE status pending→active)
  - Nuevos mensajes que actualicen `last_message_at`
- También suscribirse a INSERT de `chat_messages` del evento para refrescar el preview de la lista.
- Invalidar `['direct-conversations', eventId, attendeeId]` en cada cambio. Cleanup con `removeChannel` en unmount.

**3. Migración Supabase**
- `ALTER TABLE chat_conversations REPLICA IDENTITY FULL;` — necesario para que los UPDATEs propaguen correctamente vía realtime y la lista se actualice en vivo cuando otro usuario acepta una invitación.

**4. `src/hooks/useMessaging.ts`** (verificación)
- `useDirectMessages`: ya usa `refetchInterval: false`. Mantener — el realtime cubrirá la actualización.
- `useCreateDirectConversation` / `useAcceptConversation`: ya invalidan correctamente.

### Resultado esperado
- El emisor ve su mensaje aparecer instantáneamente al pulsar Enviar.
- El receptor ve el mensaje llegar en menos de 1 s sin recargar.
- La lista de conversaciones se actualiza en vivo: nuevas invitaciones aparecen solas, aceptaciones se reflejan, último mensaje y orden se actualizan.
- Tras aceptar una invitación pendiente, los mensajes futuros llegan sin necesidad de cerrar y reabrir el chat.

### Notas técnicas
- Cumple `realtime-cleanup-pattern` (siempre `supabase.removeChannel` en cleanup).
- Cumple regla offline: la suscripción se activa sólo cuando `isOnline === true`.
- El update optimista usa un id temporal `temp-${uuid}` y el dedupe por `id` ya existente filtra el real cuando llega del servidor.

