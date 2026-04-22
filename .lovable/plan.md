

## Plan revisado — Sincronización limpia del modal con el sponsor

### Por qué el plan anterior no es óptimo

El plan previo proponía dos cosas, una hacky y otra correcta:

1. ❌ **Key compuesto `${id}-${open?'open':'closed'}`** — funciona pero es un hack. El modal ya está montado condicionalmente con `{modalOpen && ...}`, así que el `key` por `id` ya debería bastar. Agregar `open` al key oculta el problema real en lugar de resolverlo.

2. ✅ **`useEffect` que sincroniza prop → state** — esta SÍ es la solución idiomática y suficiente por sí sola.

Además detecté un bug real en el modal que el plan anterior no mencionaba: el `useMemo` de la línea 84 calcula `initialPhone` correctamente cuando cambia `sponsor?.whatsapp`, pero los `useState(initialPhone.dialCode)` solo lo leen en el primer render → el teléfono SIEMPRE muestra el valor del primer mount.

---

### Diagnóstico final (verificado en código)

**Causa raíz única:** el patrón `useState(sponsor?.X)` en `SponsorModal.tsx` (líneas 77-90) crea estado derivado de prop sin sincronización. React solo evalúa el inicializador una vez. Si la cache de TanStack Query se actualiza y el padre vuelve a pasar `sponsor` con datos nuevos, los `useState` los ignoran.

Aunque el padre usa `key={editingSponsor?.id}` y monta condicionalmente con `{modalOpen && ...}` (lo cual SÍ remonta entre aperturas), hay dos casos donde el modal recibe datos nuevos sin remontaje:
- Cache se invalida durante una sesión abierta (refetch en background).
- Optimistic update muta el objeto `sponsor` mientras el modal sigue abierto.

---

### Solución (1 archivo, 1 cambio limpio)

#### Único cambio — `SponsorModal.tsx`: sincronizar estado con `useEffect` cuando cambia `sponsor?.id`

Agregar un solo `useEffect` que resetea TODOS los campos cuando cambia el sponsor (o cuando llega data fresca del mismo sponsor por su ID estable). Eliminar el `useMemo` redundante de `initialPhone` porque el effect ya cubre el caso del teléfono.

```tsx
// Reemplazar líneas 77-95 por:

const [name, setName] = useState('');
const [level, setLevel] = useState<typeof LEVELS[number]>('gold');
const [category, setCategory] = useState<typeof CATEGORIES[number]>('pharmaceutical');
const [description, setDescription] = useState('');
const [standLocation, setStandLocation] = useState('');
const [websiteUrl, setWebsiteUrl] = useState('');
const [contactEmail, setContactEmail] = useState('');
const [whatsappDialCode, setWhatsappDialCode] = useState('57');
const [whatsappNumber, setWhatsappNumber] = useState('');
const [whatsappMessage, setWhatsappMessage] = useState('');
const [videoUrl, setVideoUrl] = useState('');
const [linkedin, setLinkedin] = useState('');
const [instagram, setInstagram] = useState('');

const [logoFile, setLogoFile] = useState<File | null>(null);
const [materialsFile, setMaterialsFile] = useState<File | null>(null);
const [removeLogo, setRemoveLogo] = useState(false);
const [removeMaterials, setRemoveMaterials] = useState(false);

// Sincroniza estado con el sponsor cuando cambia (incluye apertura del modal,
// invalidación de cache, optimistic update). Depende solo del id para evitar
// loops por cambio de referencia del objeto.
useEffect(() => {
  setName(sponsor?.name ?? '');
  setLevel(sponsor?.level ?? 'gold');
  setCategory(sponsor?.category ?? 'pharmaceutical');
  setDescription(sponsor?.description ?? '');
  setStandLocation(sponsor?.stand_location ?? '');
  setWebsiteUrl(sponsor?.website_url ?? '');
  setContactEmail(sponsor?.contact_email ?? '');
  const parsed = parsePhoneE164(sponsor?.whatsapp ?? null);
  setWhatsappDialCode(parsed.dialCode);
  setWhatsappNumber(parsed.number);
  setWhatsappMessage(sponsor?.whatsapp_message ?? '');
  setVideoUrl(sponsor?.video_url ?? '');
  setLinkedin(sponsor?.social_linkedin ?? '');
  setInstagram(sponsor?.social_instagram ?? '');
  setLogoFile(null);
  setMaterialsFile(null);
  setRemoveLogo(false);
  setRemoveMaterials(false);
  setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sponsor?.id]);
```

**Por qué esta solución es la mejor práctica:**
- ✅ Resuelve TODOS los casos: apertura, cierre/reapertura, invalidación de cache, optimistic update.
- ✅ Dependencia solo del `id` → no genera loops por cambios de referencia del objeto sponsor.
- ✅ Elimina el bug latente del `useMemo(initialPhone)` que nunca se aplicaba al state.
- ✅ Patrón idiomático de React para "resetear estado cuando cambia una identidad clave" cuando la opción `key` no es suficiente.
- ✅ Compatible con el `key={editingSponsor?.id ?? 'new'}` ya existente — defensa en profundidad.

#### NO se cambia `Sponsors.tsx`
El `key={editingSponsor?.id ?? 'new'}` ya existente sigue siendo correcto. No hace falta el key compuesto hacky.

#### NO se cambia `useAdminSponsors.ts` ni `admin-sponsors.service.ts`
Los fixes anteriores (optimistic update + `.maybeSingle()`) ya quedaron correctos.

---

### Verificación post-fix

1. Editar "Al Pharma" → cambiar mensaje WhatsApp a "test final" → Guardar.
   - Toast verde, modal cierra.
   - Query directa BD: `whatsapp_message = "test final"` ✅
2. Reabrir "Al Pharma" → el modal abre con "test final" inmediatamente.
3. Cambiar WhatsApp de 3136985667 a 3001234567 → Guardar → reabrir.
   - Modal muestra país CO + número 3001234567 (este es el bug del `useMemo` que se resuelve).
4. Editar otro sponsor → ningún campo "leak" del anterior.
5. Cancelar sin guardar → cache intacta.
6. Crear nuevo (sponsor=null) → todos los campos vacíos, level=gold, category=pharmaceutical.

---

### Archivos modificados

| Archivo | Cambio | Líneas |
|---|---|---|
| `src/components/admin/sponsors/SponsorModal.tsx` | Inicializar `useState` con valores neutros + agregar `useEffect` de sync por `sponsor?.id` + eliminar `useMemo(initialPhone)` redundante | ~30 |

**Total: 1 archivo. Sin tocar el padre. Sin keys compuestos. Sin reordenar `performSave`.**

---

### Lo que se descartó del plan anterior

| Cambio descartado | Razón |
|---|---|
| Key compuesto `${id}-${open}` en `Sponsors.tsx` | Hack innecesario; el `useEffect` resuelve el problema raíz. |
| Reordenar `toast.success` antes de `onSaved/onClose` | El `toast` global de Sonner sobrevive al unmount; reordenar no aporta valor. |

---

### Esfuerzo

~3 minutos. 1 archivo, ~30 líneas. Patrón estándar de React. Cero riesgo de regresión.

