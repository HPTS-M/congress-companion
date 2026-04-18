

## Análisis del cambio solicitado

### Estado actual

En `src/components/attendee/DirectConversationList.tsx` (líneas 51-77), el `useEffect` crea un canal de Supabase Realtime con **dos listeners**:

```ts
const channel = supabase
  .channel(`conv-list-${eventId}-${attendeeId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'chat_conversations',
      filter: `event_id=eq.${eventId}`,
    },
    invalidate
  )
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    invalidate
  )
  .subscribe();
```

Cada vez que **cualquier** mensaje se inserta en `chat_messages` (de cualquier conversación, de cualquier evento, de cualquier usuario), se dispara `invalidate()` que refetchea la query `['direct-conversations', eventId, attendeeId]`.

### Impacto del cambio (eliminar el listener de `chat_messages`)

**Lo que se pierde:**
- La lista de conversaciones ya no se refresca automáticamente cuando llega un mensaje nuevo. El "preview" del último mensaje (`last_message_preview`) y el timestamp (`last_message_at`) en cada tarjeta de conversación dejarán de actualizarse en tiempo real mientras el usuario está parado en la lista.
- El reordenamiento por actividad reciente tampoco se actualizará en vivo.

**Lo que se mantiene:**
- Crear/aceptar/rechazar/eliminar conversaciones SÍ sigue actualizando la lista, porque eso modifica `chat_conversations` (que conserva su listener).
- Dentro de un chat abierto (`DirectChatView`), los mensajes en tiempo real siguen funcionando porque ese componente tiene su propio canal independiente.
- Cuando el usuario entre/salga de una conversación, los datos se refrescan vía invalidación normal de TanStack Query.

**Por qué tiene sentido el cambio:**
- El listener actual es **muy ruidoso**: escucha TODOS los inserts de `chat_messages` globalmente (no tiene filtro por evento ni por conversación). En un evento con cientos de asistentes activos, esto genera invalidaciones constantes y refetches innecesarios de la lista entera.
- La actualización del preview/timestamp depende de un trigger DB (`update_conversation_last_message`) que ya actualiza la fila de `chat_conversations` → con el listener restante de `chat_conversations` (event: '*'), esos cambios SÍ se capturarán igual vía el UPDATE de la conversación. **Es decir: el preview de último mensaje seguirá llegando en tiempo real, solo que disparado por el UPDATE de la conversación, no por el INSERT del mensaje.**

> Conclusión: la pérdida funcional real es prácticamente nula, y la ganancia en eficiencia (menos invalidaciones, menos refetches, menos tráfico realtime) es significativa.

### Plan de cambio (mínimo, quirúrgico)

Modificar **únicamente** `src/components/attendee/DirectConversationList.tsx`:

- Eliminar el segundo `.on(...)` (líneas 71-75 aprox., el que escucha `INSERT` en `chat_messages`).
- Conservar:
  - El primer `.on(...)` sobre `chat_conversations` con filtro `event_id=eq.${eventId}`.
  - El `.subscribe()` encadenado.
  - El cleanup `supabase.removeChannel(channel)`.
  - El array de dependencias `[eventId, attendeeId, isOnline, queryClient]`.
  - Toda la lógica de guardas (`if (!eventId || !attendeeId || !isOnline) return;`).

Resultado esperado:

```ts
const channel = supabase
  .channel(`conv-list-${eventId}-${attendeeId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'chat_conversations',
      filter: `event_id=eq.${eventId}`,
    },
    invalidate
  )
  .subscribe();
```

### Restricciones honradas

- Cumple `realtime-cleanup-pattern` (cleanup intacto).
- No toca otros archivos.
- No cambia hooks, servicios, queries ni RLS.
- No introduce regresiones en `DirectChatView` (que tiene su propio canal).

