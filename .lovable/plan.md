

## Plan: Indicadores ✓ enviado y ✓✓ entregado en chat (best practices)

### Alcance

Solo dos estados visuales en mensajes propios (sin "leído"):

| Estado | Icono | Cuándo |
|---|---|---|
| Enviado al servidor | **✓** gris | Mensaje persistido en `chat_messages` |
| Entregado al receptor | **✓✓** gris | El otro asistente lo descargó en su dispositivo |

Se mantienen los estados existentes 🕐 pendiente offline · ⟳ enviando · ⚠ falló.

---

### Best practices aplicadas

1. **Backend-first**: migración SQL + RLS antes de tocar UI.
2. **`SECURITY DEFINER` con validación interna** vía `get_my_attendee_ids()` — nunca `auth.uid()` dentro del cuerpo, siempre parámetro explícito.
3. **Idempotencia**: la RPC filtra `delivered_at IS NULL`, llamarla N veces es seguro.
4. **Índice parcial** sobre `(conversation_id) WHERE delivered_at IS NULL` para que el UPDATE masivo no escanee tabla completa.
5. **Realtime con cleanup explícito** (`supabase.removeChannel`) — regla del proyecto.
6. **Optimistic update vía `setQueryData`**, no `invalidateQueries`, para evitar refetch en cada UPDATE entrante.
7. **i18n estricto** — sin strings hardcodeados; `aria-label` traducido en cada icono.
8. **Sin "leído"** — privacidad por defecto, escalable a un toggle futuro.
9. **TypeScript estricto** — tipo `ChatMessage` extendido, sin `any`.
10. **Throttle de marcado**: en el list, batchear `markDelivered` por conversación con un debounce de 500 ms para evitar spam de RPC cuando llegan varios INSERT seguidos.

---

### Cambios

#### 1. Migración SQL
- `ALTER TABLE chat_messages ADD COLUMN delivered_at timestamptz NULL;`
- `CREATE INDEX idx_chat_messages_undelivered ON chat_messages(conversation_id) WHERE delivered_at IS NULL;`
- Función `mark_messages_delivered(_conversation_id uuid, _attendee_id uuid)` `SECURITY DEFINER`:
  - Valida `_attendee_id IN (SELECT get_my_attendee_ids())`.
  - `UPDATE chat_messages SET delivered_at = now() WHERE conversation_id = _conversation_id AND sender_id != (sender del receptor) AND delivered_at IS NULL`.
  - Resuelve el `sender_id` ajeno comparando contra los `attendee_id` del receptor a través de la conversación.
- `GRANT EXECUTE ... TO authenticated` y revoke a `anon`.
- Confirmar que `chat_messages` ya está en la publicación de Realtime para `UPDATE` (si no, agregar).

#### 2. Servicio + hook
- `messagingService.markDelivered(conversationId, attendeeId)` — llama la RPC.
- Tipo `ChatMessage` añade `delivered_at: string | null`.
- Hook `useMarkDelivered()` con `useMutation` — sin invalidar, solo dispara.

#### 3. UI — render del icono (`DirectChatView.tsx`)
Solo en mensajes propios (`isOwn`):

```text
[hora]  [icono]
```

- Pendiente offline → 🕐 (existente)
- Enviando → ⟳ (existente)
- Falló → ⚠ rojo (existente)
- Real, sin `delivered_at` → **✓** gris (`Check` de `lucide-react`, `size={14}`, `text-white/70`)
- Real, con `delivered_at` → **✓✓** gris (`CheckCheck`, mismo tamaño y color)

Mensajes recibidos: solo hora, sin icono.

#### 4. Cuándo marcar entregado
- **`DirectChatView`**: al montar y al recibir INSERT realtime estando abierto → `markDelivered`.
- **`DirectConversationList`**: al recibir INSERT realtime de cualquier conversación → debounce 500 ms → `markDelivered`.

#### 5. Realtime para refrescar el ✓ → ✓✓ del emisor
Ampliar el canal existente en `DirectChatView` para escuchar `event: 'UPDATE'` en `chat_messages` filtrado por `conversation_id`. Al recibir UPDATE:

```ts
queryClient.setQueryData(['direct-messages', conversationId], (old) =>
  old?.map(m => m.id === payload.new.id ? { ...m, delivered_at: payload.new.delivered_at } : m)
);
```

Sin refetch.

---

### Archivos afectados

```text
NUEVA migración SQL                                  delivered_at + índice + RPC + grants
src/services/messaging.service.ts                    markDelivered + tipo ChatMessage
src/hooks/useMessaging.ts                            useMarkDelivered
src/components/attendee/DirectChatView.tsx           UPDATE en realtime, markDelivered, render ✓/✓✓
src/components/attendee/DirectConversationList.tsx   markDelivered debounced al recibir INSERT
src/locales/es/messaging.json + en/messaging.json    statusSent, statusDelivered (aria-labels)
```

Sin tocar el flujo offline ni el worker de cola.

---

### Verificación

1. Dos navegadores, dos asistentes A y B.
2. A envía → **✓ gris** inmediato.
3. B abre la app (cualquier pantalla) → en A pasa a **✓✓ gris** en segundos.
4. B totalmente offline → A sigue viendo **✓**. Cuando B vuelve y carga conversaciones → A ve **✓✓**.
5. A sin internet → 🕐 → al volver online → ⟳ → ✓ → ✓✓.
6. Recibidos: nunca muestran iconos de estado, solo hora.
7. Confirmar en consola que no hay refetch de mensajes en cada UPDATE (solo `setQueryData`).

