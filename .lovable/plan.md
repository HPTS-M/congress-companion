

## Mejores prácticas y mitigación de riesgos — feature "Responder a mensajes"

Revisé el plan original de "Responder a un mensaje" contra (a) las guidelines del proyecto (RLS, i18n, dark mode, mobile-first) y (b) los riesgos típicos de chat replies. Aquí está el plan endurecido.

---

### Riesgo 1 — RLS incompleta en la nueva columna `reply_to_id`

**Problema:** Si solo agrego la columna sin verificar que las políticas existentes la cubran, un atacante autenticado podría enviar un `reply_to_id` apuntando a un mensaje de OTRA conversación (cross-conversation leak en la UI cuando se renderice el quote).

**Mitigación:**
- Agregar **trigger BEFORE INSERT/UPDATE** en `chat_messages` que valide:
  ```sql
  IF NEW.reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM chat_messages
      WHERE id = NEW.reply_to_id
        AND conversation_id = NEW.conversation_id
    ) THEN
      RAISE EXCEPTION 'reply_to_id must reference a message in the same conversation';
    END IF;
  END IF;
  ```
- `ON DELETE SET NULL` ya está previsto (mantiene integridad sin romper layout).
- No agregar nuevas políticas RLS — la columna se cubre con las existentes de `chat_messages` porque cualquier SELECT ya filtra por `conversation_id` accesible al usuario.

---

### Riesgo 2 — Long-press dispara menú nativo del navegador

**Problema:** En iOS Safari/Android Chrome, `touchstart` largo abre el menú de copiar/seleccionar texto del SO, rompiendo nuestra UX.

**Mitigación:**
- Aplicar `user-select: none` y `-webkit-touch-callout: none` SOLO al contenedor de la burbuja (no al texto seleccionable global).
- En el handler: `e.preventDefault()` en `contextmenu` event.
- Usar timer de 500ms con `clearTimeout` en `touchend`/`touchmove`/`touchcancel` para evitar que un scroll dispare el menú accidentalmente.
- Threshold de movimiento: si el dedo se mueve >10px durante el long-press → cancelar (es un scroll, no un long-press).
- Vibración táctil opcional con feature detection: `if ('vibrate' in navigator) navigator.vibrate(40)`.

---

### Riesgo 3 — XSS por contenido de quote no sanitizado

**Problema:** Si renderizo el contenido del mensaje citado vía `dangerouslySetInnerHTML` o concateno HTML, un mensaje con `<script>` o markdown malicioso podría ejecutar código.

**Mitigación:**
- **Nunca usar `dangerouslySetInnerHTML`** (es regla del proyecto, sección 14).
- Renderizar el quote como texto plano dentro de un `<div>` con `className="line-clamp-2"`.
- Tailwind `whitespace-pre-wrap` para respetar saltos de línea sin permitir HTML.
- Truncar a 120 caracteres en el cliente antes de mostrar (defensa en profundidad).
- Validar con Zod en el cliente: `replyToId: z.string().uuid().optional()`.

---

### Riesgo 4 — Validación de input débil (replyToId malformado)

**Problema:** Si el cliente envía `reply_to_id` malformado o referencia un UUID que no existe, podría romper la UI o ser un vector de fuzzing.

**Mitigación:**
- Schema Zod en `messaging.service.ts` antes del INSERT:
  ```typescript
  const sendMessageSchema = z.object({
    conversationId: z.string().uuid(),
    content: z.string().trim().min(1).max(2000),
    replyToId: z.string().uuid().optional().nullable(),
  });
  ```
- El trigger DB (Riesgo 1) atrapa los UUIDs inexistentes o cross-conversation.
- Si la validación Zod falla → mostrar toast con `t('messaging.errorSending')` y NO enviar.

---

### Riesgo 5 — Quote roto cuando el mensaje original está fuera de la lista cargada

**Problema:** El plan original resuelve el quote desde `merged` (lookup local). Si el chat tiene 500 mensajes y el original está más arriba sin cargar, el quote aparece como "Mensaje eliminado" — falso negativo confuso.

**Mitigación:**
- Extender `getMessages` para incluir un JOIN ligero al mensaje citado:
  ```sql
  SELECT m.*, 
         r.id as reply_id, r.content as reply_content, 
         r.sender_id as reply_sender_id, r.deleted_at as reply_deleted_at
  FROM chat_messages m
  LEFT JOIN chat_messages r ON r.id = m.reply_to_id
  WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC;
  ```
- Devolver el quote ya resuelto como objeto `reply_to: { id, content, sender_id, was_deleted }`.
- Distinguir explícitamente: `was_deleted: true` → "Mensaje eliminado"; `reply_to: null` (sin reply) → no renderizar quote.
- Truncar `reply_content` a 120 chars en el SELECT para no inflar el payload.

---

### Riesgo 6 — Scroll-to-message falla cuando el mensaje no está en el DOM

**Problema:** `scrollIntoView` sobre un `id` que no existe (mensaje muy antiguo no cargado) no hace nada — el usuario ve un click muerto.

**Mitigación:**
- Antes del scroll, comprobar `document.getElementById(\`msg-${id}\`)`.
- Si no existe → toast informativo `t('messaging.messageNotInView')` ("Mensaje fuera de vista").
- Si existe → scroll + flash highlight con `data-flash="true"` y animación CSS de 1.5s.
- Animación CSS en `index.css` con dark mode soportado:
  ```css
  @keyframes flash-highlight {
    0%   { background-color: hsl(45 93% 47% / 0.4); }
    100% { background-color: transparent; }
  }
  [data-flash="true"] { animation: flash-highlight 1.5s ease-out; }
  ```

---

### Riesgo 7 — i18n incompleta (hardcoded strings)

**Problema:** Las guidelines son tajantes: cero strings hardcodeados (sección 8). Es fácil olvidar el aria-label del menú o el tooltip del botón ✕.

**Mitigación:**
- Checklist completo de keys nuevas en `es/en messaging.json`:
  - `reply` ("Responder" / "Reply")
  - `replying` ("Respondiendo a {{name}}")
  - `cancelReply` ("Cancelar respuesta")
  - `copy`, `copied`
  - `messageDeleted` ("Mensaje eliminado")
  - `messageNotInView` ("Mensaje fuera de vista")
  - `replyAriaLabel` ("Responder a este mensaje")
- Lint manual: grep en el código nuevo por strings entre comillas que no vengan de `t(...)`.

---

### Riesgo 8 — Dark mode + contraste del quote

**Problema:** El quote es un sub-elemento dentro de la burbuja. Si la burbuja propia es azul `#1A56A0`, el quote interno debe seguir legible en dark/light, en burbuja propia y ajena.

**Mitigación:**
- Dos variantes de quote según dueño de la burbuja:
  - Propia (azul): fondo `bg-white/15`, borde izquierdo `border-l-2 border-white/60`, texto `text-white/90`.
  - Ajena (gris): fondo `bg-background/80 dark:bg-slate-900/40`, borde izquierdo en color del nivel del autor, texto `text-foreground/80`.
- Probar contraste WCAG AA (4.5:1) en ambos temas antes de mergear.

---

### Riesgo 9 — Cola offline pierde el `replyToId` en sincronización

**Problema:** Si el usuario responde offline, el mensaje queda en `pending_messages_v1` localStorage. Si el formato de `PendingMessage` cambia (agregar `replyToId`), los items viejos en cola se rompen al deserializar.

**Mitigación:**
- Versionar la cola: cambiar `STORAGE_KEY = 'pending_messages_v2'`.
- En `lib/pending-messages.ts`, al leer: si encuentra `pending_messages_v1` → migrar items existentes agregando `replyToId: undefined` y mover a v2; borrar v1.
- El worker `useMessageQueueWorker` pasa `replyToId` al servicio sin asumir que existe (default `undefined`).

---

### Riesgo 10 — Duplicación con realtime al confirmar el mensaje enviado con reply

**Problema:** El optimistic update inserta una burbuja temporal con `reply_to`. Cuando llega la confirmación realtime, el dedupe actual matchea por `sender + content` — pero NO valida que el `reply_to_id` sea el mismo. Si el usuario respondió 2 veces al mismo mensaje con texto idéntico, se podría borrar el equivocado.

**Mitigación:**
- Extender el dedupe en el handler realtime a comparar también `reply_to_id`:
  ```typescript
  const withoutTemp = old.filter(
    m => !(m.id.startsWith('temp-')
        && m.sender_id === newMsg.sender_id
        && m.content === newMsg.content
        && (m.reply_to_id ?? null) === (newMsg.reply_to_id ?? null))
  );
  ```

---

### Riesgo 11 — Performance: re-render de toda la lista al abrir menú contextual

**Problema:** Si el menú contextual se maneja con state global (`activeMenuId`), todo el array de mensajes re-renderiza al abrir/cerrar.

**Mitigación:**
- Encapsular cada burbuja en un componente `MessageBubble` con `React.memo` y comparar por `id + delivered_at + reply_to.was_deleted`.
- El estado del menú vive dentro del propio `MessageBubble` (no en el padre).
- Esto también ayuda al cumplir el target FCP <1.5s (sección 12).

---

### Resumen de archivos finales

```text
NEW   supabase/migrations/{ts}_add_reply_to_chat_messages.sql
        — columna reply_to_id + index + trigger validate_reply_same_conversation

EDIT  src/services/messaging.service.ts
        — Zod schema sendMessageSchema + JOIN al mensaje citado en getMessages

EDIT  src/hooks/useMessaging.ts
        — propagar replyToId en useSendMessage

EDIT  src/lib/pending-messages.ts
        — STORAGE_KEY v2 + migración desde v1 + tipo extendido con replyToId

EDIT  src/hooks/useMessageQueueWorker.ts
        — pasar replyToId al servicio al sincronizar

EDIT  src/components/attendee/DirectChatView.tsx
        — extraer MessageBubble (memo), long-press con threshold,
          banner reply, render del quote (XSS-safe), scroll-to con guard,
          dedupe extendido en realtime

EDIT  src/locales/es/messaging.json + en/messaging.json
        — keys: reply, replying, cancelReply, copy, copied,
          messageDeleted, messageNotInView, replyAriaLabel

EDIT  src/index.css
        — @keyframes flash-highlight con [data-flash="true"]
```

---

### Verificación end-to-end (qué probar)

1. **RLS cross-conversation**: como atacante, intentar enviar `reply_to_id` apuntando a mensaje de OTRA conversación → debe fallar con error del trigger.
2. **XSS**: enviar mensaje con `<script>alert(1)</script>` y responderlo → el quote debe mostrar el texto plano, sin ejecutar JS.
3. **Long-press móvil**: presionar 500ms una burbuja en iOS Safari y Android Chrome → menú custom aparece, NO el del SO.
4. **Long-press cancelado por scroll**: presionar burbuja y mover dedo >10px → menú NO aparece.
5. **Scroll-to mensaje cargado**: tap en quote de mensaje visible → scroll suave + flash 1.5s.
6. **Scroll-to mensaje NO cargado**: tap en quote de mensaje muy antiguo → toast "Mensaje fuera de vista".
7. **Mensaje original borrado**: borrar el original → quote en respuesta muestra "Mensaje eliminado" en cursiva.
8. **Offline reply**: sin conexión, responder mensaje → entra en cola con `replyToId` → reconectar → se envía con quote correcto.
9. **Migración de cola v1→v2**: con un item viejo en `pending_messages_v1` localStorage, abrir la app → migra sin romper.
10. **Dark mode**: contraste del quote en burbuja propia y ajena, ambos temas → legible.
11. **i18n**: cambiar a inglés → todas las nuevas keys traducidas, ningún string hardcodeado visible.
12. **Performance**: chat con 200 mensajes → abrir menú contextual no causa lag perceptible.

