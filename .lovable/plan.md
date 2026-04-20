

## Diagnóstico real

Mirando el código completo y la captura del usuario:

1. El render ya prioriza `merged.length > 0` correctamente (línea 283).
2. `enqueue` y el listener de `pending-messages:changed` están bien cableados.
3. **La causa más probable del bug actual**: en el **preview interno de Lovable** (iframe), `navigator.onLine` y los eventos `online`/`offline` no son confiables (lección LL-005). El banner amarillo "Offline" se muestra porque otro mecanismo lo detectó, pero `useOnlineStatus()` puede devolver `true`. Entonces `handleSend`:
   - Toma la rama **online** (línea 144)
   - Hace optimistic update con `tempId`
   - Llama `messagingService.sendMessage` → falla por red
   - Entra al `catch` → **rollback del optimistic** + `enqueue`
   - El mensaje pasa a localStorage como pending
   - Pero el `setQueryData` optimista ya se borró, y el render de `pending` depende del evento custom que **a veces no llega antes de que el componente se re-renderice por otra razón**

4. Adicional: el `enqueue` en el hook usa `useCallback` con deps vacías — está bien — pero el `setItems` interno se basa en escuchar el evento. Si Lovable preview suprime algunos eventos custom dentro del iframe, el render no ocurre.

5. Tu captura muestra "No messages yet" — eso indica que `merged.length === 0`, o sea que **el enqueue ni siquiera llegó a localStorage**, o que el componente no se enteró del cambio.

## Solución

Hacer el flujo a prueba de balas, **independiente del estado de `navigator.onLine`** y del evento custom:

### Cambios en `src/components/attendee/DirectChatView.tsx`

1. **`handleSend` siempre encola primero**, sin importar `isOnline`:
   - Llamar `enqueue(...)` inmediatamente → el mensaje queda persistido y visible al instante.
   - Si estamos online, disparar `pending-messages:flush` para que el worker lo procese de una vez (ya lo hace `usePendingMessages.enqueue`).
   - Eliminar la rama optimista con `setQueryData` + rollback. El worker se encarga de todo y el realtime traerá el mensaje real cuando llegue.
   - Resultado: comportamiento idéntico tipo WhatsApp en online y offline. Si estás online, el badge "Pendiente" aparece por una fracción de segundo y el worker lo envía. Si estás offline, queda esperando reconexión.

2. **`enqueue` retorna el `PendingMessage` creado** → usarlo para hacer un `setItems` local inmediato (sin esperar el evento custom):
   - Modificar `usePendingMessages` para que `enqueue` haga `setItems(prev => [...prev, msg])` directamente, además de seguir disparando el evento para sincronizar otras instancias.
   - Esto garantiza que el render del chat refleje el mensaje **en el mismo tick**, sin depender de listeners del DOM.

### Cambios en `src/hooks/usePendingMessages.ts`

3. Hacer que `enqueue`, `retry` y `remove` actualicen el `items` local **sincrónicamente** además de disparar el evento, para que el componente que los llama vea el cambio inmediatamente sin depender de la propagación del evento custom.

### Cambios en `src/hooks/useOnlineStatus.ts`

4. Endurecer la detección agregando una verificación con `fetch('/favicon.ico', { cache: 'no-store' })` opcional — pero esto suma complejidad. **Mejor solución**: como ya no dependemos del flag para enrutar el envío (siempre encolamos), la detección actual basta.

### Resultado esperado

- Offline o online: al pulsar enviar, el mensaje aparece **inmediatamente** con badge "Pendiente" (🕐).
- Si online: el worker dispara el envío, el realtime trae el mensaje real, el pending se borra del localStorage y el badge desaparece.
- Si offline: el mensaje persiste en localStorage. Al reconectar (`online` event o `attendee:reconnected`), el worker lo envía automáticamente.
- Reload offline → el mensaje sigue visible con badge pendiente.

### Verificación end-to-end

1. **Importante**: probar en **pestaña nueva** (URL real publicada), no en el preview interno — el preview interno tiene problemas conocidos con `navigator.onLine` (LL-005).
2. DevTools → Network → Offline.
3. Enviar un mensaje → debe aparecer al instante con 🕐 "Pendiente de envío".
4. Reload estando offline → mensaje sigue ahí.
5. Network → Online → aparece banner amarillo "Sincronizando" → el mensaje se envía → badge desaparece → mensaje real llega vía realtime.

### Archivos tocados

- ✏️ `src/components/attendee/DirectChatView.tsx` — simplificar `handleSend` para siempre encolar.
- ✏️ `src/hooks/usePendingMessages.ts` — actualizar `items` local sincrónicamente en `enqueue`/`retry`/`remove`.

Sin cambios en BD, RLS, worker (que ya funciona) ni dependencias nuevas.

