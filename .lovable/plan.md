

## Diagnóstico

El bug está en `DirectChatView.tsx` líneas 282-300:

**Caso A — chat ya tiene mensajes en caché (visitado online antes):**
- React Query devuelve `messages` desde caché → `merged.length > 0` → render correcto ✅

**Caso B — chat sin caché (recién abierto offline o tras reload offline):**
- `useDirectMessages` se dispara → fetch a Supabase → falla por offline
- Mientras tanto `isLoading = true` indefinidamente, o pasa a `isError`
- Render entra en rama `isLoading` (skeletons) o `merged.length === 0` (estado vacío "noMessages")
- **Los pendientes nunca se ven** aunque estén en `pending` y en `merged`

**Por qué pasa:** la lógica de render tiene 4 ramas excluyentes (`isPending` → `isLoading` → `merged.length===0` → lista). Cuando `isLoading=true` por offline, salta los pendientes aunque existan.

Además: si el usuario abre por primera vez una conversación estando offline, **`enqueue` sí guarda el mensaje en localStorage**, pero el render lo oculta detrás del skeleton/empty state.

## Solución

Reordenar las condiciones de render: **si hay mensajes en `merged` (reales o pendientes), siempre mostrar la lista**, sin importar `isLoading`. El skeleton solo cuando NO hay nada que mostrar Y está cargando.

### Cambios en `src/components/attendee/DirectChatView.tsx`

1. **Reordenar condicionales del render** (línea 273-374):
   ```
   1. isPending (conversación no aceptada) → mensaje informativo
   2. merged.length > 0 → SIEMPRE mostrar la lista (incluye pendientes)
   3. isLoading → skeletons
   4. Sino → estado vacío "noMessages"
   ```

2. **Asegurar que `merged` se calcula incluso cuando `messages` viene vacío por error de red**: ya funciona porque `useQuery` devuelve `data = []` por defecto y `pendingAsMessages` se construye desde localStorage independiente de la query.

3. **Pequeño detalle en `handleSend`**: cuando estamos offline, la query `messages` puede ser `[]` y el render bajo el bug actual no muestra nada. Tras el reorden, el mensaje pendiente aparecerá inmediatamente porque `merged.length > 0`.

4. **Auto-scroll también con pendientes**: cambiar dependencia del `useEffect` de scroll de `[messages.length]` a `[merged.length]` para que también haga scroll cuando se agrega un pendiente.

### Verificación end-to-end

1. Login asistente, abrir un chat existente estando online (precarga caché)
2. DevTools → Offline
3. Escribir y enviar 2 mensajes → deben aparecer **inmediatamente** con 🕐 "Pendiente"
4. Recargar página estando offline → abrir el mismo chat → los pendientes siguen visibles
5. Abrir un chat **nunca visitado** estando offline → escribir un mensaje → debe aparecer con 🕐 (no skeleton infinito)
6. Volver online → mensajes se envían, badges desaparecen, llega vía realtime el real

### Archivos tocados

- ✏️ `src/components/attendee/DirectChatView.tsx` — solo reordenar render + ajustar dependencia de scroll

Sin cambios en BD, sin nuevas dependencias, sin tocar el worker (que ya funciona correctamente).

