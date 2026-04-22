

## Plan — Fix: Cambios del modal "Editar patrocinador" no se reflejan

### Diagnóstico

Inspeccioné el flujo completo (modal → hook → service → BD) y verifiqué el estado real de la tabla `sponsors`. Hallazgos:

**Estado en BD (verificado):**
- El patrocinador "Al Pharma" SÍ tiene `whatsapp_message: "prueba"` y `whatsapp: "3136985667"` persistidos.
- Otros patrocinadores tienen `whatsapp` en formato E.164 correcto (`+573009876543`), confirmando que el modal sí escribe al menos algunos campos.
- **Conclusión:** los cambios SÍ llegan a la BD, pero el usuario percibe que "no se toman" por dos problemas combinados.

**Problema 1 — Cache no se actualiza optimísticamente tras `update`**

`src/hooks/useAdminSponsors.ts` líneas 57-61:
```ts
const updateMutation = useMutation({
  mutationFn: ({ id, form }) => adminSponsorsService.update(id, form),
  onSuccess: () => qc.invalidateQueries({ queryKey: key }),  // ← solo invalida
});
```

Comparado con `createMutation` que SÍ tiene `onMutate` con actualización optimista y `onSuccess` que reemplaza la fila optimista por la real:
- Tras `update`, `invalidateQueries` dispara un refetch async.
- Mientras el refetch viaja, la lista de la página y el `editingSponsor` (que se pasa al modal en la próxima edición) usan datos stale.
- Si el usuario reabre el modal antes de que el refetch llegue, ve los valores viejos.

**Problema 2 — `.single()` post-UPDATE puede lanzar error si RLS filtra**

`src/services/admin-sponsors.service.ts` línea 79-87:
```ts
const { data, error } = await supabase
  .from('sponsors')
  .update(form)
  .eq('id', id)
  .select()
  .single();
```

La política `Admins manage org sponsors` permite UPDATE, pero el `.select()` post-UPDATE evalúa políticas SELECT independientemente. Aunque las políticas vigentes deberían cubrir al admin, cualquier glitch (rol expirado, organization_id null momentáneamente) hace que `.single()` lance `PGRST116: No rows returned` aunque el UPDATE haya tenido éxito → el modal muestra toast rojo "Error al editar" y el usuario asume que nada se guardó.

**Problema 3 — `editingSponsor` no se refresca tras invalidar**

`src/pages/admin/Sponsors.tsx` líneas 47, 88-91:
- `editingSponsor` es state local con la fila clicada.
- `handleCloseModal` lo resetea, pero entre mientras la lista refresca y el usuario hace clic en "Editar" de nuevo, recibe la fila NUEVA del cache. OK.
- El verdadero issue: cuando guarda y cierra, la tabla muestra valores viejos durante 100-500ms hasta que el refetch resuelve.

---

### Solución (3 capas, buenas prácticas)

#### Capa 1 — `useAdminSponsors`: actualización optimista en `update`

Replicar el patrón del `createMutation` para `updateMutation`:

```ts
const updateMutation = useMutation({
  mutationFn: ({ id, form }: { id: string; form: ... }) =>
    adminSponsorsService.update(id, form),
  onMutate: async ({ id, form }) => {
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<SponsorRow[]>(key);
    qc.setQueryData<SponsorRow[]>(key, (old) =>
      (old ?? []).map((s) =>
        s.id === id
          ? { ...s, ...form } as SponsorRow
          : s
      )
    );
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous);
  },
  onSuccess: (updated) => {
    if (updated) {
      qc.setQueryData<SponsorRow[]>(key, (old) =>
        (old ?? []).map((s) => (s.id === updated.id ? updated : s))
      );
    }
    qc.invalidateQueries({ queryKey: key });
  },
});
```

Beneficios:
- ✅ La lista refleja el cambio inmediatamente (sin esperar refetch).
- ✅ Si el server falla, `onError` revierte al estado previo.
- ✅ Cuando el server responde, se sincroniza con datos canónicos.
- ✅ Patrón consistente con `createMutation` ya existente.

#### Capa 2 — Service `update`: tolerar respuesta vacía sin lanzar

`src/services/admin-sponsors.service.ts`:

```ts
async update(
  id: string,
  form: Partial<SponsorFormData> & { logo_url?: string | null; materials_url?: string | null }
): Promise<SponsorRow | null> {
  const { data, error } = await supabase
    .from('sponsors')
    .update(form)
    .eq('id', id)
    .select()
    .maybeSingle();  // ← cambia .single() → .maybeSingle()
  if (error) throw new Error(error.message);
  return data as SponsorRow | null;
},
```

Cambios:
- `.single()` → `.maybeSingle()`: si RLS filtra el SELECT post-UPDATE, devuelve `null` sin lanzar (el UPDATE ya se ejecutó).
- Tipo retorno `SponsorRow | null` para reflejar el contrato real.
- El `onSuccess` del hook ya maneja `if (updated) { ... }`.

Trade-off documentado: si el UPDATE falla por RLS (USING denegado), el cliente lo verá porque `error` sí se propaga. Solo cubrimos el caso "UPDATE OK + SELECT denegado".

#### Capa 3 — Modal: indicar éxito incluso si server no devuelve fila

`src/components/admin/sponsors/SponsorModal.tsx` líneas 245-261: el flujo actual (toast + `onSaved + onClose`) ya funciona bien con la corrección anterior. No requiere cambios.

---

### Verificación

1. **Editar "Al Pharma": cambiar mensaje de WhatsApp de "prueba" a "Hola, soy admin"** → guardar → toast verde → reabrir modal → ver "Hola, soy admin" sin parpadeo ni delay.
2. **Editar logo + texto en una sola operación** → ambos cambios persisten.
3. **Editar y cancelar (sin guardar)** → cache no se contamina, valores quedan como estaban.
4. **Simular fallo de red durante update** → DevTools throttle offline → toast rojo + lista vuelve al estado anterior (rollback).
5. **Verificar query directa en BD** post-edit → datos coinciden con lo guardado.

---

### Archivos a modificar

| Archivo | Cambio | Líneas aprox |
|---|---|---|
| `src/hooks/useAdminSponsors.ts` | `updateMutation`: añadir `onMutate` (optimista) + `onError` (rollback) + `onSuccess` con sync de fila | ~25 |
| `src/services/admin-sponsors.service.ts` | `update`: `.single()` → `.maybeSingle()`, retorno `SponsorRow \| null` | ~3 |

---

### Lo que NO se toca

- RLS de `sponsors` (las políticas actuales son correctas; el admin SÍ tiene UPDATE+SELECT permitidos).
- UI del modal `SponsorModal.tsx` (el flujo es correcto).
- `Sponsors.tsx` (la página padre solo consume el hook, sin lógica propia de cache).
- `createMutation` (ya tiene patrón optimista correcto).
- Tabla `sponsors` schema, triggers, ni storage.

---

### Esfuerzo

~10 minutos. 2 archivos. Cero riesgo de regresión: el patrón optimista es idéntico al ya probado en `createMutation`.

