
Objetivo: corregir el chat del asistente para que un mensaje escrito/enviado sin conexión aparezca inmediatamente en pantalla con estado “Pendiente”, y luego se reintente solo al recuperar red.

Diagnóstico confirmado:
- La cola offline sí existe (`pending-messages.ts`, `usePendingMessages`, `useMessageQueueWorker`).
- El problema está en `DirectChatView.tsx`: aunque `pending` se mezcla en `merged`, el render sigue cayendo en skeleton/estado vacío antes de mostrar esa lista.
- Tu captura coincide con eso: chat vacío + input visible + mensaje no reflejado.

Qué voy a cambiar:
1. En `src/components/attendee/DirectChatView.tsx`
   - Priorizar el render de `merged.length > 0` por encima de `isLoading` y del estado vacío.
   - Mantener el estado “pending / sending / failed” en cada burbuja.
   - Ajustar el auto-scroll para reaccionar al total renderizado (`merged`) y no solo a mensajes del servidor.
   - Revisar que el `handleSend` offline deje siempre el mensaje en cola sin depender de datos remotos.

2. Mantener intacto el worker existente
   - `useMessageQueueWorker` ya escucha reconexión y hace flush automático.
   - No hace falta tocar BD ni RLS.

3. Verificación esperada
   - Offline en un chat reciente: al enviar, aparece enseguida la burbuja con “Pendiente”.
   - Reload offline: el mensaje sigue visible.
   - Volver online: cambia a envío automático y desaparece el estado pendiente cuando entra el mensaje real.

Archivo a tocar:
- `src/components/attendee/DirectChatView.tsx`

Riesgo bajo:
- Es un ajuste de prioridad de render/UI; no cambia contratos de datos ni servicios.
