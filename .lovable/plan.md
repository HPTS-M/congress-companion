

## Validación técnica de documentos en área comercial (patrocinadores)

### Objetivo

Reforzar la carga de **logo** y **materiales (PDF)** en `SponsorModal.tsx` para que el sistema:
1. Rechace archivos con formato/tamaño inválido **en el momento de selección** (no al guardar).
2. Confirme que el archivo subido existe en Storage y tiene tamaño > 0 después del upload.
3. Dé feedback claro al admin: éxito, error, tipo permitido, tamaño máximo.

### Estado actual vs. problemas detectados

| Archivo | Validación actual | Problema |
|---|---|---|
| Logo (imagen) | `accept="image/*"` + límite 2MB **al guardar** | Acepta SVG (riesgo XSS), no valida MIME real, error tardío |
| Materiales (PDF) | **Sin `accept`**, sin validación MIME, 10MB **al guardar** | Admite cualquier formato; si se sube .docx o .zip, se guarda igual |
| Post-upload | No hay verificación | Si Storage devuelve path pero objeto corrupto o 0 bytes, pasa desapercibido |

### Cambios a realizar

#### 1. `src/lib/file-validation.ts` (nuevo)

Utilidad centralizada reutilizable:

```ts
export const SPONSOR_LOGO_MIME = ['image/png','image/jpeg','image/webp'];
export const SPONSOR_LOGO_EXT  = ['png','jpg','jpeg','webp'];
export const SPONSOR_LOGO_MAX  = 2 * 1024 * 1024;

export const SPONSOR_MATERIALS_MIME = ['application/pdf'];
export const SPONSOR_MATERIALS_EXT  = ['pdf'];
export const SPONSOR_MATERIALS_MAX  = 10 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  code?: 'empty' | 'invalid_type' | 'invalid_ext' | 'too_large';
}

export function validateFile(file: File, allowedMime: string[], allowedExt: string[], maxSize: number): FileValidationResult
```

La función verifica: tamaño > 0, `file.type` en lista MIME, extensión del nombre en lista permitida, tamaño ≤ max. Se alinea con la regla de memoria `storage/event-sponsors-storage` (imágenes PNG/JPG/WEBP; materiales solo PDF).

#### 2. Modificar `src/components/admin/sponsors/SponsorModal.tsx`

**a. Validación inmediata al seleccionar archivo:**

- Nuevo handler `handleLogoSelect(file)` y `handleMaterialsSelect(file)` que:
  - Llaman a `validateFile(...)`.
  - Si falla → `toast.error(t('sponsors.validation.fileX'))` con mensaje específico y NO setean el estado.
  - Si pasa → `setLogoFile(file)` / `setMaterialsFile(file)`.
- Restringir el input del logo a `accept="image/png,image/jpeg,image/webp"` (excluye SVG).
- Agregar `accept="application/pdf"` al input de materiales (actualmente vacío).

**b. Verificación post-upload:**

- Ampliar `adminSponsorsService.uploadFile` para devolver `{ path, size }` y **después** del upload hacer una llamada a `supabase.storage.from(BUCKET).list(eventId, { search: filename })` o un HEAD vía `createSignedUrl` + `fetch(method:'HEAD')` para confirmar que el objeto existe con tamaño > 0.
- Si la verificación falla → `throw new Error('upload_verification_failed')` y mostrar toast de error + revertir estado (sin actualizar la fila de sponsors).

**c. Mover validación de tamaño de `performSave` al handler de selección** (el fallback en `performSave` se mantiene como defensa en profundidad).

**d. Feedback visual:**

- Mostrar tamaño del archivo junto al nombre (`1.2 MB`).
- Estado `uploadingLogo` / `uploadingMaterials` → spinner en el botón durante el upload + verificación.

#### 3. Modificar `src/services/admin-sponsors.service.ts`

```ts
async uploadFile(eventId, file, prefix): Promise<{ path: string; size: number }> {
  // subida actual ...
  // verificación post-upload:
  const { data: list } = await supabase.storage.from(BUCKET).list(eventId, {
    search: filename,
  });
  const uploaded = list?.find(o => o.name === filename);
  if (!uploaded || (uploaded.metadata?.size ?? 0) === 0) {
    // cleanup + throw
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error('verification_failed');
  }
  return { path, size: uploaded.metadata.size };
}
```

- Actualizar `performSave` para consumir `{path, size}` en lugar del string plano.

#### 4. i18n — agregar claves en `src/locales/es/admin.json` y `en/admin.json`

Bajo `sponsors.validation`:

```json
"fileTypeLogo": "El logo debe ser PNG, JPG o WEBP.",
"fileTypeMaterials": "Los materiales deben ser un archivo PDF.",
"fileSizeLogo": "El logo no puede superar 2 MB.",
"fileSizeMaterials": "Los materiales no pueden superar 10 MB.",
"fileEmpty": "El archivo está vacío o dañado.",
"uploadVerificationFailed": "La subida no se pudo verificar. Intenta de nuevo.",
"uploadSuccess": "Archivo subido correctamente."
```

### Resultado esperado

1. Al seleccionar un logo no-imagen o SVG → toast rojo inmediato, el archivo no queda en el estado.
2. Al seleccionar un material que no sea PDF → toast rojo inmediato.
3. Archivos mayores al límite se rechazan antes de siquiera abrir la petición a Storage.
4. Tras el upload, el servicio confirma existencia + tamaño > 0; si falla, se hace cleanup y el sponsor NO se guarda con un `logo_url` / `materials_url` roto.
5. Durante la subida, botones deshabilitados + spinner; al terminar, toast verde de éxito.

### Consideraciones

- No requiere cambios de BD ni RLS: solo UI + servicio cliente.
- El bucket `event-sponsors` ya es privado con isolation por folder `{event_id}/` (memoria `storage/event-sponsors-storage`), así que la verificación `list()` está permitida para admins del evento.
- Defensa en profundidad: se valida **al seleccionar**, **antes de subir** y **después de subir**.
- Patrón reutilizable vía `src/lib/file-validation.ts` para aplicar luego a documentos académicos, importaciones CSV, etc.

