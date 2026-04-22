

## Plan — Implementación de los 3 cambios coordinados (RLS ya corregido)

### Contexto

La policy RLS de UPDATE en `sponsors` ya fue corregida en BD. Ahora aplicamos las 3 capas del frontend que faltan para garantizar que el flujo de edición sea robusto: fail-fast en el service, reconciliación garantizada en el hook, y `editingSponsor` derivado del cache vivo en la página.

---

### Cambio 1 — `src/services/admin-sponsors.service.ts`

Separar UPDATE de SELECT en el método `update()`. Detectar 0 filas afectadas como error explícito.

```ts
async update(
  id: string,
  form: Partial<SponsorFormData> & { logo_url?: string | null; materials_url?: string | null },
): Promise<SponsorRow> {
  // 1. UPDATE explícito con count exacto. Si la policy bloquea o el id no existe, count === 0.
  const { error: updateError, count } = await supabase
    .from('sponsors')
    .update(form, { count: 'exact' })
    .eq('id', id);
  if (updateError) throw new Error(updateError.message);
  if (count === 0) {
    throw new Error('update_no_rows_affected');
  }

  // 2. SELECT separado para devolver datos canónicos frescos.
  const { data, error: selectError } = await supabase
    .from('sponsors')
    .select('*')
    .eq('id', id)
    .single();
  if (selectError) throw new Error(selectError.message);
  return data as SponsorRow;
},
```

**Cambios clave:**
- Tipo de retorno: `Promise<SponsorRow>` (no nullable).
- Lanza `update_no_rows_affected` si UPDATE no toca filas → toast rojo en UI.
- SELECT separado → datos canónicos garantizados para reconciliar cache.

---

### Cambio 2 — `src/hooks/useAdminSponsors.ts`

Simplificar `updateMutation`: `onSuccess` siempre recibe `SponsorRow`; mover `invalidateQueries` a `onSettled` para refetch garantizado incluso ante error.

```ts
const updateMutation = useMutation({
  mutationFn: ({ id, form }: { id: string; form: Parameters<typeof adminSponsorsService.update>[1] }) =>
    adminSponsorsService.update(id, form),
  onMutate: async ({ id, form }) => {
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<SponsorRow[]>(key);
    qc.setQueryData<SponsorRow[]>(key, (old) =>
      (old ?? []).map((s) => (s.id === id ? ({ ...s, ...form } as SponsorRow) : s)),
    );
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous);
  },
  onSuccess: (updated) => {
    // updated SIEMPRE es SponsorRow real (contrato del service ya no es nullable)
    qc.setQueryData<SponsorRow[]>(key, (old) =>
      (old ?? []).map((s) => (s.id === updated.id ? updated : s)),
    );
  },
  onSettled: () => {
    // Refetch garantizado: corre en éxito Y en error → cache siempre converge a BD real
    qc.invalidateQueries({ queryKey: key });
  },
});
```

**Cambios clave:**
- Eliminar el `if (updated)` del `onSuccess` (ya no hace falta).
- `invalidateQueries` se mueve de `onSuccess` a `onSettled` → garantiza refetch incluso en rollback.

---

### Cambio 3 — `src/pages/admin/Sponsors.tsx`

Reemplazar el snapshot local `editingSponsor` por derivación del cache vivo vía `useMemo`. Mantener solo el `id` en estado local.

```tsx
const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);

const editingSponsor = useMemo(
  () => (editingSponsorId ? sponsors.find((s) => s.id === editingSponsorId) ?? null : null),
  [sponsors, editingSponsorId],
);

const handleEdit = useCallback((s: SponsorRow) => {
  setEditingSponsorId(s.id);
  setModalOpen(true);
}, []);

const handleCloseModal = useCallback(() => {
  setModalOpen(false);
  setEditingSponsorId(null);
}, []);
```

**Cambios clave:**
- `editingSponsor` ahora se recalcula automáticamente cuando `sponsors` (cache) cambia → optimistic update y refetch se reflejan inmediatamente en el modal.
- El `key={editingSponsor?.id ?? 'new'}` ya existente sigue funcionando.
- El `useEffect` de sync por `sponsor?.id` en `SponsorModal` (ya implementado) recibe siempre el dato más fresco.

---

### Lo que NO se toca

- `src/components/admin/sponsors/SponsorModal.tsx` — el `useEffect` de sync ya quedó correcto.
- RLS policies / schema — ya corregido en BD.
- `createMutation` y `deleteMutation` — siguen funcionando.

---

### Verificación post-implementación

1. Editar "Al Pharma" → cambiar mensaje WhatsApp → Guardar.
   - Toast verde, modal cierra, tabla muestra valor nuevo.
   - Query directa BD: valor nuevo persistido.
2. Reabrir "Al Pharma" → modal muestra valor nuevo inmediatamente.
3. Si la policy llegara a fallar (escenario imposible ahora pero defensivo): toast rojo + rollback automático de la tabla.
4. Editar otro sponsor → datos correctos sin leakage.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/services/admin-sponsors.service.ts` | `update()` separa UPDATE+count de SELECT, lanza si 0 filas, retorna `SponsorRow` no nullable |
| `src/hooks/useAdminSponsors.ts` | `updateMutation`: `onSuccess` simplificado, `invalidateQueries` movido a `onSettled` |
| `src/pages/admin/Sponsors.tsx` | `editingSponsor` derivado del cache vivo con `useMemo`, solo `editingSponsorId` en estado |

**Total: 3 archivos, ~25 líneas modificadas.**

