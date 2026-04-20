

## Diagnóstico real: por qué el dashboard de admin no muestra resultados

Después de inspeccionar el flujo end-to-end (UI admin → servicio admin → tabla `poll_responses` → RLS → flujo de submisión del asistente), confirmé que **el dashboard SÍ está mostrando todo lo que existe**. El problema es que **la tabla `poll_responses` tiene 0 filas en toda la base de datos**, es decir, ninguna respuesta está siendo persistida. Esto se debe a dos bugs reales:

### 🔴 Bug #1 — UNIQUE constraint rompe `multiple_choice`

La tabla `poll_responses` tiene este constraint:
```
UNIQUE (poll_id, attendee_id)
```

Pero `polls.service.ts` (líneas 96-104) inserta **una fila por cada opción seleccionada** cuando el tipo es `multiple_choice`:
```ts
const rows = optionIds.map(optionId => ({ poll_id, attendee_id, option_id, text_response: null }));
await supabase.from('poll_responses').insert(rows); // ❌ rechaza el batch entero
```

Resultado: cualquier `multiple_choice` con ≥1 opción siempre falla con violación de unicidad → **0 votos persistidos**.

Para `single_choice`, `rating_scale` y `open_text` (que insertan 1 fila), el constraint no rompe el insert, pero igual no hay datos porque solo 2 asistentes tienen sesión activa de Supabase Auth en todo el evento (`user_id` no nulo). Por eso tampoco hay respuestas de los demás tipos.

### 🟡 Bug #2 — UX engañosa para errores de RLS

`pollsService.submitResponse` valida duplicados *antes* del insert con un SELECT, pero ese SELECT está sujeto a la política `Attendees read own responses` (filtra por `attendee_id IN get_my_attendee_ids()`). Si el asistente no tiene `user_id`, el SELECT devuelve `[]` (no error), el código asume "no es duplicado", e intenta el INSERT, que también es bloqueado por RLS y devuelve un error genérico que se muestra como "Error al enviar respuesta". Pero hoy ningún asistente reporta esto porque casi todos no han iniciado sesión.

### ✅ Verificación de la "lógica de filtrado y visualización" del admin

- `adminPollsService.getPollResults(pollId)` lee TODA `poll_responses` sin filtros adicionales (solo `eq('poll_id', pollId)`).
- La RLS `Admins read org poll responses` da acceso a todas las respuestas de polls del evento del admin.
- `getTextResponses` también lee todas las filas con `text_response IS NOT NULL`.
- El conteo en la rejilla principal (`getPolls`) usa la misma tabla sin paginar.

**Conclusión:** la capa de visualización del admin está correcta. No hay datos que mostrar porque ninguno se está guardando.

---

## Plan de cambios

### 1. Migración SQL: cambiar el constraint para soportar multiple_choice

```sql
-- Eliminar el UNIQUE actual que rompe multiple_choice
ALTER TABLE public.poll_responses 
  DROP CONSTRAINT poll_responses_poll_id_attendee_id_key;

-- Reemplazo: una opción no puede estar duplicada por el mismo asistente,
-- pero un asistente sí puede insertar varias filas (varias opciones distintas)
ALTER TABLE public.poll_responses
  ADD CONSTRAINT poll_responses_unique_option_per_attendee
  UNIQUE NULLS NOT DISTINCT (poll_id, attendee_id, option_id);
```

`NULLS NOT DISTINCT` garantiza que para `open_text` (donde `option_id IS NULL`) un mismo asistente solo pueda enviar una respuesta. Para choice polls, evita duplicar la misma opción dos veces. Para multiple_choice permite N filas con `option_id` distinto.

### 2. `src/services/polls.service.ts` — Validación robusta de duplicados

- Mantener el SELECT previo de duplicados (más amigable que el error de constraint).
- Mejorar el manejo de errores del INSERT: si el código de error PostgreSQL es `23505` (unique_violation), mapearlo a `DUPLICATE_VOTE` para que el toast sea correcto.
- Para `open_text`, mantener una sola fila (ya está bien hoy).

```ts
const { error } = await supabase.from('poll_responses').insert(rows);
if (error) {
  if (error.code === '23505') throw new Error('DUPLICATE_VOTE');
  throw new Error(error.message);
}
```

### 3. `src/hooks/usePolls.ts` — Toast con detalle del error de RLS

Hoy el toast de error muestra solo `error.message`. Cuando RLS bloquea el INSERT, Supabase devuelve un mensaje críptico. Añadir detección y mensaje claro: si el mensaje incluye `row-level security` o `policy`, mostrar al asistente "Tu sesión no permite votar — vuelve a iniciar sesión" (en i18n).

### 4. (Opcional, recomendado) Verificar visibilidad para el admin con un dato semilla de prueba

No se incluye en la migración, pero después de aplicar los cambios el equipo puede iniciar sesión con dos códigos distintos del evento `MCONG-20260420` y enviar votos en cada tipo (multiple/single/rating/open_text) para validar de punta a punta que aparecen en el dashboard.

---

## Resumen

| # | Cambio | Archivo |
|---|---|---|
| 1 | Reemplazar UNIQUE constraint en `poll_responses` | Nueva migración SQL |
| 2 | Mapear error `23505` → `DUPLICATE_VOTE` | `src/services/polls.service.ts` |
| 3 | Mensaje de error i18n claro para RLS | `src/hooks/usePolls.ts` + `src/locales/{es,en}/common.json` |

### Por qué este enfoque

- **Backend-first:** la causa raíz es de datos (constraint), no de UI. Arreglar la UI sin arreglar la BD no recolecta votos.
- **No tocar RLS:** las políticas actuales de `poll_responses` son correctas y seguras (admins de la org, asistentes de su propia respuesta).
- **No tocar el dashboard del admin:** ya muestra todo lo que la BD contiene; el filtrado y la agregación están bien.
- **`NULLS NOT DISTINCT`:** patrón estándar de PostgreSQL 15+ para tratar `NULL` como igual en UNIQUE — soportado por Supabase.

### Resultado esperado

- ✅ `multiple_choice` permite seleccionar N opciones y todas se guardan.
- ✅ `single_choice` / `rating_scale` / `open_text` siguen funcionando con 1 voto por asistente.
- ✅ El intento de votar dos veces se detecta y muestra "Ya respondiste esta encuesta".
- ✅ El dashboard de admin (`Polls.tsx > ResultsModal`) refleja inmediatamente los nuevos votos vía realtime (`usePollRealtime` ya está activo).
- ✅ Reportes (`/admin/reports` → tab Encuestas) y exportaciones Excel (`adminPollsExcelService`) ahora tendrán datos reales.

