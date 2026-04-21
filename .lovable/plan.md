

## Plan — Eliminar mensajes pendientes/fallidos no enviados

### Alcance
Permitir al usuario eliminar (descartar) un mensaje propio que **no llegó al servidor**: estados `pending` (en cola offline), `failed` (falló tras reintentos) y opcionalmente `sending` (en vuelo). Los mensajes ya enviados (con `id` real del servidor) **no son eliminables** — se mantiene la regla actual.

### Esfuerzo estimado
**Bajo (~30-45 min).** Toda la infraestructura backend ya existe:
- `pendingMessages.remove(id)` en `src/lib/pending-messages.ts` ya implementado.
- Hook `usePendingMessages` ya expone `remove`.
- Solo falta cablear la acción en el UI y manejar el caso `sending` con cuidado.

### Cambios

**1. `src/components/attendee/DirectChatView.tsx`**
- Cambiar la condición `canActOnMessage = !pendingInfo && !msg.id.startsWith('temp-')` para permitir abrir el menú también cuando `pendingInfo` existe — pero con un menú **diferente** según el estado:
  - **Mensaje real (enviado)**: opciones actuales → `Responder`, `Copiar`.
  - **Mensaje fallido (`failed`)**: opciones → `Reintentar`, `Copiar`, `Eliminar` (destructivo, rojo).
  - **Mensaje pendiente (`pending`)**: opciones → `Copiar`, `Eliminar` (destructivo).
  - **Mensaje en envío (`sending`)**: solo `Copiar` (no permitir eliminar mientras está en vuelo, evita race condition con el worker).
- Agregar nueva prop `onDiscard: (pendingId: string) => void` al `MessageBubble`.
- En el componente padre, obtener `remove` del hook `usePendingMessages` y pasarlo como `onDiscard`.
- Al ejecutar discard: llamar `remove(pendingId)` + `toast({ title: t('messageDiscarded') })`.
- Confirmación: usar `AlertDialog` ligero para evitar borrados accidentales (especialmente en mobile con long-press).

**2. `src/locales/es/messaging.json` y `en/messaging.json`**
Nuevas claves:
```json
"discard": "Eliminar",
"discardConfirmTitle": "¿Eliminar este mensaje?",
"discardConfirmBody": "Este mensaje no se ha enviado. Se perderá permanentemente.",
"discardConfirmAction": "Eliminar",
"discardCancel": "Cancelar",
"messageDiscarded": "Mensaje eliminado"
```

### Detalles técnicos

- **Sin cambios en backend ni DB**: no hay registro en `chat_messages` aún, solo en `localStorage`. Al hacer `remove`, `pendingMessages` dispara `pending-messages:changed` → la lista se refresca automáticamente vía `usePendingMessages`.
- **Race condition con worker**: si el mensaje está `sending` cuando el usuario lo descarta, el worker podría completar el envío segundos después. Por eso bloqueamos discard en `sending`. Si en el futuro se quiere permitir cancelación dura, requeriría un flag `aborted` y verificación en el worker antes de `markSending`.
- **Estética del item destructivo**: usar `text-destructive` en `DropdownMenuItem` con icono `Trash2` de lucide.
- **Accesibilidad**: agregar `aria-label` y `role` al item de eliminar; el `AlertDialog` ya cubre lectores de pantalla.

### Fuera de alcance
- Eliminar mensajes ya entregados al servidor (regla del producto: no se permite).
- Sincronización cross-device de descarte (no aplica: el pending vive solo en el localStorage del dispositivo que lo creó).

