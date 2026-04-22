

## Plan — Migración de signed URLs → public URLs (event-sponsors + speaker-photos)

### Resumen

Los buckets `event-sponsors` y `speaker-photos` ya son públicos en Supabase. Reemplazamos `createSignedUrl` por `getPublicUrl` en todo el código, manteniendo signatures `async` para no romper consumidores. Migramos URLs ya guardadas en `events.settings` para que no expiren al año. `event-documents` queda intacto.

---

### Beneficios

| Métrica | Hoy (signed) | Después (public) |
|---|---|---|
| Logos sponsors en Commercial (N=20) | ~20 round-trips a Storage API (~600ms total) | 0 round-trips (síncrono local) |
| Logo sponsor en SponsorDetail | 1 round-trip (~80ms) | 0 round-trips |
| Foto speaker en SessionModal admin | 1 round-trip por sesión | 0 round-trips |
| Banner/logo evento (Home, Header) | URL caduca a 1 año (bomba de tiempo) | URL permanente |
| Cache CDN | Limitado (signed query params rotativos) | Pleno (URLs estables) |

**Beneficio cualitativo:** Commercial directory carga instantáneamente; ya no hay 20 spinners de logo en mobile lento.

---

### Cambios técnicos

#### 1. `src/services/sponsors.service.ts` — bucket `event-sponsors`

Reemplazar la función `resolveStorageUrl` async + signed por una versión síncrona que envuelve `getPublicUrl`:

```ts
function resolveStorageUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
```

En `getByEvent`: eliminar `Promise.all` sobre URLs — el mapeo se vuelve síncrono. La función sigue siendo `async` (firma intacta).

En `getById`: eliminar `Promise.all([resolveStorageUrl(logo), resolveStorageUrl(materials)])`, llamar directo. Signature sigue `async`.

#### 2. `src/services/admin-sponsors.service.ts` — bucket `event-sponsors`

`getSignedUrl` se mantiene como método `async` para no romper a `SponsorMaterialPreviewModal`, `SponsorDetailDrawer`, `SponsorModal`, pero internamente usa `getPublicUrl`:

```ts
getSignedUrl: async (path: string): Promise<string> => {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
},
```

(Opcionalmente renombrable a `getAssetUrl` en el futuro; no lo hacemos ahora para evitar tocar 4 archivos extra.)

#### 3. `src/services/admin-agenda.service.ts` — bucket `speaker-photos`

`getSpeakerPhotoUrl` mantiene firma `async`, internamente usa `getPublicUrl`:

```ts
getSpeakerPhotoUrl: async (path: string): Promise<string | null> => {
  if (!path) return null;
  return supabase.storage.from('speaker-photos').getPublicUrl(path).data.publicUrl;
},
```

`SpeakerPhotoUpload.tsx` no requiere cambios — sigue haciendo `await` sobre la promesa.

#### 4. `src/components/admin/EventBrandingCard.tsx` — bucket `event-sponsors`

Reemplazar la generación de signed URL de 1 año por `getPublicUrl`. Esto elimina la "bomba de tiempo" de URLs que caducan. Como `getPublicUrl` es síncrono, simplificamos el flujo de upload (sin `await` sobre el URL builder).

#### 5. Migración SQL — actualizar URLs ya guardadas

URLs almacenadas hoy en `events.settings.banner_url` y `events.settings.header_logo_url` son signed (caducan al año). Hay que reescribirlas a public URL extrayendo el path de la URL signed.

**Estructura signed:** `https://<ref>.supabase.co/storage/v1/object/sign/event-sponsors/<path>?token=...`
**Estructura public:** `https://<ref>.supabase.co/storage/v1/object/public/event-sponsors/<path>`

Migración:

```sql
UPDATE events
SET settings = jsonb_set(
  settings,
  '{banner_url}',
  to_jsonb(
    regexp_replace(
      split_part(settings->>'banner_url', '?', 1),
      '/storage/v1/object/sign/',
      '/storage/v1/object/public/'
    )
  )
)
WHERE settings->>'banner_url' LIKE '%/storage/v1/object/sign/event-sponsors/%';

UPDATE events
SET settings = jsonb_set(
  settings,
  '{header_logo_url}',
  to_jsonb(
    regexp_replace(
      split_part(settings->>'header_logo_url', '?', 1),
      '/storage/v1/object/sign/',
      '/storage/v1/object/public/'
    )
  )
)
WHERE settings->>'header_logo_url' LIKE '%/storage/v1/object/sign/event-sponsors/%';
```

`split_part(..., '?', 1)` elimina el query string del token. `regexp_replace` cambia `sign` → `public`.

---

### Lo que NO se toca

- `event-documents` (sigue privado, sigue con `createSignedUrl` en `adminDocumentsService` y `documentsService`).
- `useDocuments`, `useAdminDocuments`, `DocumentPreviewModal`, etc.
- Ninguna RLS, ninguna política de Storage.
- Logos de logos cargados en `attendees.avatar_url` u otros (no aplica).

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/services/sponsors.service.ts` | `resolveStorageUrl` síncrona con `getPublicUrl` |
| `src/services/admin-sponsors.service.ts` | `getSignedUrl` async wrapper de `getPublicUrl` |
| `src/services/admin-agenda.service.ts` | `getSpeakerPhotoUrl` async wrapper de `getPublicUrl` |
| `src/components/admin/EventBrandingCard.tsx` | Reemplazo de signed por public en upload de banner/logo |
| Migración SQL | UPDATE de `events.settings.banner_url` y `header_logo_url` |

---

### Verificación

1. **Commercial directory mobile:** abrir `/ACQFH-2026/commercial` con 20 sponsors → todos los logos aparecen sin "parpadeo" inicial.
2. **Sponsor detail:** abrir un sponsor → logo y PDF de materiales abren al instante.
3. **Admin EventBranding:** subir un banner nuevo → URL guardada en BD comienza con `/storage/v1/object/public/event-sponsors/`.
4. **Migración:** después de correr el SQL, query manual `SELECT settings->>'banner_url' FROM events;` confirma que ya no aparece `?token=` ni `/sign/`.
5. **Speaker photo en SessionModal admin:** crear sesión nueva, subir foto → preview aparece sin retraso.
6. **Documentos académicos:** abrir cualquier documento desde `/ACQFH-2026/documents` → sigue funcionando con signed URL (no tocado).

---

### Consideración de seguridad

Los buckets ya son públicos en Supabase (decisión confirmada por el usuario). Cualquier persona con la URL puede acceder a logos, fotos de speaker y PDFs de sponsors. Esto es aceptable porque:
- Logos y fotos son material promocional/branding.
- PDFs de sponsors son material comercial diseñado para distribución.
- Las URLs no son adivinables (incluyen UUIDs y timestamps).

---

### Esfuerzo

~15 minutos. 4 archivos + 1 migración SQL. Cero cambios de tipos, RLS o consumidores.

