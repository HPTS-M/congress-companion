

## Plan — Fix limpio: Eliminación de encuestas con respuestas

### Diagnóstico confirmado

**Síntoma:** Toast rojo "Error al eliminar encuesta" al borrar polls que tienen respuestas registradas.

**Causa raíz (ya identificada):**
1. La tabla `poll_responses` no tiene política `DELETE` para admins de organización (solo SELECT, INSERT y ALL para superusers).
2. La tabla `poll_options` tampoco tiene política `DELETE` para admins.
3. Cuando un admin ejecuta `DELETE FROM poll_responses WHERE poll_id = X`, RLS filtra a 0 filas silenciosamente — no es error, simplemente no borra nada.
4. Las respuestas siguen en BD → `DELETE FROM polls` revienta con violación de FK `poll_responses_poll_id_fkey`.
5. Adicionalmente el código actual (`adminPollsService.deletePoll`) ignora el error de las dos primeras llamadas, ocultando el problema.

Las encuestas sin respuestas sí se borran porque no hay nada protegiendo la FK.

---

### Solución limpia (DB + servicio)

#### Capa 1 — Migración SQL

Agregar políticas `DELETE` para admins de organización en `poll_responses` y `poll_options`. Sigue el patrón existente del módulo (`get_user_organization(auth.uid())`).

```sql
-- Admins eliminan respuestas de encuestas de su organización
CREATE POLICY "Admins delete org poll responses"
ON public.poll_responses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM polls p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = poll_responses.poll_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);

-- Admins eliminan opciones de encuestas de su organización
CREATE POLICY "Admins delete org poll options"
ON public.poll_options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM polls p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = poll_options.poll_id
      AND e.organization_id = get_user_organization(auth.uid())
  )
);
```

**Por qué políticas explícitas y no `ON DELETE CASCADE`:**
- Modificar la FK requiere DROP + ADD CONSTRAINT y puede romper otras validaciones.
- Las políticas explícitas son trazables y consistentes con el patrón ya usado en `Admins manage poll options` (que cubre INSERT/UPDATE pero no DELETE — completamos la matriz).
- Cumple regla LL-001/LL-002 del knowledge base: cada operación necesita política explícita.

#### Capa 2 — Refactor `deletePoll` con buenas prácticas

`src/services/admin-polls.service.ts`:

```ts
async deletePoll(pollId: string): Promise<void> {
  // Orden de borrado: dependencias primero (respuestas → opciones → poll)
  // Cada paso captura su error para diagnóstico claro.
  
  const { error: responsesError } = await supabase
    .from('poll_responses')
    .delete()
    .eq('poll_id', pollId);
  if (responsesError) {
    throw new Error(`Failed to delete poll responses: ${responsesError.message}`);
  }

  const { error: optionsError } = await supabase
    .from('poll_options')
    .delete()
    .eq('poll_id', pollId);
  if (optionsError) {
    throw new Error(`Failed to delete poll options: ${optionsError.message}`);
  }

  const { error: pollError } = await supabase
    .from('polls')
    .delete()
    .eq('id', pollId);
  if (pollError) {
    throw new Error(`Failed to delete poll: ${pollError.message}`);
  }
},
```

**Buenas prácticas aplicadas:**
- ✅ Cada error capturado y propagado con contexto descriptivo (antes el primer DELETE ignoraba errores → enmascaraba RLS).
- ✅ Orden explícito de dependencias (responses → options → poll), no asumimos cascade.
- ✅ Sin try/catch global que oculte stack — `useAdminPolls.deletePoll.onError` ya muestra toast al usuario.
- ✅ Nombres descriptivos (`responsesError`, `optionsError`, `pollError`) en lugar de `error` reutilizado.
- ✅ Sin cambios a la firma pública — consumidores (`useAdminPolls`, `Polls.tsx`) intactos.

---

### Archivos modificados

| Archivo | Cambio | Líneas aprox |
|---|---|---|
| Nueva migración SQL | 2 políticas DELETE para `poll_responses` y `poll_options` | ~25 |
| `src/services/admin-polls.service.ts` | Refactor de `deletePoll` con error handling explícito | ~25 |

---

### Verificación

1. **Encuesta vacía:** eliminar → OK (sin regresión).
2. **Encuesta con respuestas:** "Tuviste acceso a los servicios toda la tarde" (3 respuestas) → toast verde, desaparece de la lista, no aparece más en BD.
3. **Logs Postgres:** ya no aparece `poll_responses_poll_id_fkey` violation.
4. **Asistente intentando borrar respuesta ajena:** sigue bloqueado (políticas existentes intactas — solo agregamos DELETE para admins, no tocamos políticas de attendees).
5. **Admin de otra organización intentando borrar encuesta ajena:** bloqueado por la condición `e.organization_id = get_user_organization(auth.uid())`.

---

### Lo que NO se toca

- Lógica de envío/respuesta de polls del lado attendee (`pollsService`, `usePolls`).
- Políticas SELECT/INSERT/UPDATE existentes en `poll_responses` y `poll_options`.
- RLS de `polls` (ya tiene políticas DELETE correctas).
- UI de `Polls.tsx`, `useAdminPolls`, modales.
- i18n, realtime, Edge Functions.

---

### Esfuerzo

~5 minutos. 1 migración SQL + 1 archivo TypeScript. Cero riesgo de regresión.

