

# Plan: Sincronización de iconos "enviado" / "entregado" en mensajería

## Diagnóstico — por qué hay desincronización

He revisado el flujo completo y encontré **tres problemas técnicos concretos** que explican por qué el ✓ verde (entregado) no aparece en tiempo real aunque ambos usuarios estén con la app abierta:

### Problema 1 — Realtime `UPDATE` se filtra por `conversation_id`, pero el payload no lo incluye

En `DirectChatView.tsx` (línea 429-449) el listener UPDATE usa:
```ts
filter: `conversation_id=eq.${conversation.id}`
```

Esto **funciona en teoría**, pero como la tabla `chat_messages` tiene `REPLICA IDENTITY FULL`, el evento `UPDATE` se dispara correctamente. El problema real está en la lógica de actualización de cache: solo actualiza `delivered_at` pero **no preserva `reply_to`** ni la posición optimista, causando que el icono parpadee/desaparezca.

### Problema 2 — `markDelivered` solo se ejecuta al ABRIR la conversación o al recibir un mensaje nuevo

Líneas 458-463 y 423-426: `markDelivered` se llama:
- ✅ Una vez al montar el componente
- ✅ Cuando llega un mensaje nuevo del otro lado

**Pero NO se llama** cuando ya tienes la conversación abierta y el otro usuario te envía un mensaje **mientras tú estabas viendo otra cosa y vuelves al tab**. Si la pestaña pierde foco y vuelve, los mensajes recibidos en ese intervalo nunca se marcan como entregados hasta que llegue uno nuevo.

### Problema 3 — Falta listener de `visibilitychange` y `focus`

Cuando el usuario A envía un mensaje y el usuario B tiene la conversación abierta pero el navegador estaba en background, el evento UPDATE puede llegar pero el RPC `mark_messages_delivered` no se vuelve a llamar al regresar a la pestaña, dejando mensajes como "solo enviado" indefinidamente.

### Problema 4 (menor) — `markDelivered` está en deps del useEffect realtime

Línea 455: `markDelivered` (objeto mutation) es nueva referencia en cada render → el canal Realtime se reabre constantemente, perdiendo eventos durante la reconexión (~200-500ms ventana ciega).

---

## Solución

### Cambio 1 — Estabilizar referencia de `markDelivered`

Usar `useCallback` para envolver el trigger del RPC, o sacar `markDelivered.mutate` del objeto y referenciar solo la función estable. Resultado: el canal Realtime se monta UNA vez por conversación, no en cada render.

### Cambio 2 — Listener `visibilitychange` para re-marcar al recuperar foco

Añadir efecto que escuche `document.visibilitychange` y `window.focus`:
```
cuando la pestaña vuelve a estar visible
  → llamar markDelivered({ conversationId, attendeeId })
```

Esto cubre el caso "tenía la conversación abierta pero el navegador estaba en otra app/tab".

### Cambio 3 — Preservar `reply_to` en el handler UPDATE

En lugar de:
```ts
m.id === updated.id ? { ...m, delivered_at: updated.delivered_at } : m
```

Hacer un merge defensivo que preserve TODOS los campos previos y solo sobrescriba `delivered_at`:
```ts
m.id === updated.id 
  ? { ...m, delivered_at: updated.delivered_at ?? m.delivered_at } 
  : m
```

Y agregar log de debug temporal para validar que los UPDATE eventos están llegando.

### Cambio 4 — Marcar como entregado también cuando el remitente recibe el UPDATE

Cuando llega un `UPDATE` con `delivered_at` no nulo, y soy el SENDER, ya debería verse el doble check. Si el listener no se está disparando, es porque el canal se está re-suscribiendo (Cambio 1 lo arregla). Como red de seguridad: hacer `invalidateQueries(['direct-messages', conversation.id])` al recibir UPDATE para garantizar refetch.

### Cambio 5 — Heartbeat de "delivered" cada 15s mientras la conversación está abierta

Como mecanismo de respaldo si Realtime falla por completo (caso PWA con conexión intermitente):
```
setInterval cada 15s mientras tab visible y online
  → llamar markDelivered (idempotente, costo casi cero)
```

El RPC ya solo actualiza filas con `delivered_at IS NULL`, así que llamarlo cada 15s no genera escrituras inútiles.

---

## Archivos afectados

```
EDIT  src/components/attendee/DirectChatView.tsx
        - Estabilizar referencia de markDelivered en useEffect realtime
        - Añadir listener visibilitychange + focus → trigger markDelivered
        - Preservar reply_to en el UPDATE handler
        - Heartbeat 15s de markDelivered mientras tab visible
        - Invalidar query al recibir UPDATE como red de seguridad
```

**1 archivo. ~20 minutos. Cero cambios de DB.**

---

## Plan de prueba (validar la sincronía)

1. **Setup:** dos navegadores con ambos usuarios (A y B) en la misma conversación abierta, ambos en foreground
2. **Test 1 — envío en vivo:** A envía mensaje → B lo recibe → A debe ver doble check ✓✓ verde **en menos de 1 segundo**
3. **Test 2 — tab de B en background:** B cambia a otra app → A envía 3 mensajes → B vuelve al tab → los 3 mensajes deben pasar a doble check ✓✓ en A en menos de 2s
4. **Test 3 — conexión intermitente:** B activa modo avión 5s → reactiva → mensajes pendientes de A se marcan como entregados al volver
5. **Test 4 — conversación cerrada en B:** B sale de la conversación → A envía mensaje → A solo ve check simple ✓ (correcto, B no la abrió). B abre → A debe ver doble check inmediato

---

## Lo que NO incluye

- Indicador de "leído" (azul) — solo "enviado/entregado". Implementarlo requeriría columna `read_at` adicional + RPC nuevo. Lo dejo para iteración separada si lo pides.
- Indicador "escribiendo..." (typing) — no estaba en el alcance original
- Cambios en push notifications — siguen funcionando como ya están

