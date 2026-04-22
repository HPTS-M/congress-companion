

## Plan — Fix: El modal "Editar Patrocinador" muestra valores viejos al reabrir

### Diagnóstico (verificado en BD + código)

**Estado en BD (confirmado vía query):**
"Al Pharma" tiene `whatsapp: 3136985667` y `whatsapp_message: "prueba"` correctamente persistidos.

**La BD SÍ se actualiza.** El problema es 100% del frontend: el modal muestra valores viejos.

**Causa raíz real:**

`src/pages/admin/Sponsors.tsx` línea 246 monta el modal así:
```tsx
{modalOpen && event && (
  <SponsorModal ... sponsor={editingSponsor} />
)}
```

Sin `key`. React reutiliza la misma instancia del componente entre aperturas consecutivas. Cuando el modal se cierra (`modalOpen=false`) y se reabre (`modalOpen=true`), si pasa rápido React puede reutilizar el árbol.

Pero el problema crítico está en `SponsorModal.tsx` líneas 77-90:
```tsx
const [name, setName] = useState(sponsor?.name ?? '');
const [whatsappMessage, setWhatsappMessage] = useState(sponsor?.whatsapp_message ?? '');
// ... 13 useState más
```

Los `useState(sponsor?.X ?? '')` **solo se evalúan en el primer render**. Cuando el padre actualiza la cache de TanStack Query con datos nuevos y vuelve a pasar `sponsor` con nuevos valores:
- ❌ Los `useState` ignoran el nuevo prop.
- ❌ El usuario ve los valores con los que abrió el modal originalmente.
- ❌ Cuando guarda y reabre, sigue viendo lo viejo (aunque la BD ya tiene lo nuevo).

Esto es un **anti-patrón clásico de React**: derivar estado inicial de props sin sincronización posterior.

**Por qué el plan anterior no resolvió el síntoma:**
El optimistic update sí actualizó la cache (la tabla detrás muestra el dato nuevo), pero al reabrir el modal, los `useState` internos seguían con los valores cacheados del primer montaje.

---

### Solución limpia (2 cambios mínimos, buenas prácticas)

#### Opción A — Forzar remontaje del modal con `key` (RECOMENDADA)

`src/pages/admin/Sponsors.tsx` línea 246-254:

```tsx
{modalOpen && event && (
  <SponsorModal
    key={editingSponsor?.id ?? 'new'}  // ← fuerza nueva instancia por sponsor
    open={modalOpen}
    onClose={handleCloseModal}
    eventId={event.id}
    sponsor={editingSponsor}
    onSaved={handleCloseModal}
  />
)}
```

**Por qué es la solución correcta:**
- ✅ Patrón recomendado oficialmente por React docs ("Resetting state with a key").
- ✅ Cada vez que cambia `editingSponsor.id`, React desmonta y remonta el modal → todos los `useState` se reinicializan con los valores nuevos.
- ✅ Cero cambios al modal en sí — preserva toda su lógica.
- ✅ Funciona tanto al editar diferentes sponsors como al reabrir el mismo después de guardar (porque entre cierres `modalOpen=false` desmonta el componente; al reabrir, `useState` corre con el sponsor recién actualizado de la cache).

#### Opción B (defensa adicional) — Sincronizar prop → state en el modal

Por seguridad, agregar un `useEffect` que sincronice cuando `sponsor.id` cambia. Pero con la opción A, esto es redundante. **No lo aplicamos** para mantener el código simple.

---

### Verificación de que la cache se actualiza correctamente

Revisé `useAdminSponsors.updateMutation` (post-fix anterior):
- ✅ `onMutate` actualiza la cache optimísticamente.
- ✅ `onSuccess` reemplaza con datos canónicos del servidor.
- ✅ `invalidateQueries` dispara refetch para sincronizar.

La cache YA está bien. Solo falta que el modal lea el dato fresco al reabrirse, lo cual logra el `key`.

---

### Archivos modificados

| Archivo | Cambio | Líneas |
|---|---|---|
| `src/pages/admin/Sponsors.tsx` | Agregar `key={editingSponsor?.id ?? 'new'}` al `<SponsorModal>` | 1 línea |

**1 archivo, 1 línea.** Solución mínima, idiomática de React.

---

### Verificación post-fix

1. Editar "Al Pharma" → cambiar mensaje WhatsApp de "prueba" a "Hola desde admin" → guardar → toast verde.
2. Reabrir "Al Pharma" → ver "Hola desde admin" inmediatamente (sin parpadeo, sin valores viejos).
3. Editar otro sponsor distinto → ver sus datos correctos (no mezclados con el anterior).
4. Crear nuevo sponsor (key="new") → modal vacío correctamente.
5. Query directa a BD → datos coinciden con UI.

---

### Lo que NO se toca

- `useAdminSponsors.ts` — el optimistic update ya quedó bien del fix anterior.
- `admin-sponsors.service.ts` — el `.maybeSingle()` ya quedó bien.
- `SponsorModal.tsx` — su lógica interna es correcta, solo necesita remontaje limpio.
- BD, RLS, storage — nada que ver.

---

### Esfuerzo

~30 segundos. 1 línea cambiada. Cero riesgo.

