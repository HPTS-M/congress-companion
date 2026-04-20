

## Plan de ajustes — Asistentes, Agenda y Documentos

### 1) ASISTENTES — Reemplazar `window.confirm` por modal pequeño mobile-first

**Archivo**: `src/components/admin/attendees/AttendeeDetailDrawer.tsx`

- Quitar `window.confirm(...)` en `handleRegenerate` (línea 63).
- Agregar estado `confirmRegenCredential` (igual que ya existe `confirmRegenAccess`).
- El botón "Regenerar código" abre un `<AlertDialog>` con:
  - Título: "Regenerar código"
  - Mensaje: "¿Estás seguro de regenerar el código? El código anterior dejará de funcionar."
  - Botones: Cancelar / Aceptar.
- Estilos: `AlertDialogContent` ya es responsive en shadcn (`max-w-lg w-[calc(100%-2rem)]`); confirmo padding y tamaño de texto adecuados a 360px.
- Añadir claves i18n en `src/locales/es/admin.json` y `en/admin.json` bajo `attendees.detail.regenerateCredentialDialog.{title,message,confirm,cancel}`.

---

### 2) AGENDA

#### 2.1 Fix carga de imagen del ponente (CRÍTICO — bug RLS)

**Causa raíz detectada**: la policy `Admins manage speaker photos` en `storage.objects` usa `storage.foldername(e.name)` (nombre del **evento**) en lugar de `storage.foldername(name)` (nombre del **archivo**). Por eso falla el upload con 403 para todo admin que no sea superuser.

**Migración SQL**:
```sql
DROP POLICY "Admins manage speaker photos" ON storage.objects;
CREATE POLICY "Admins manage speaker photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'speaker-photos'
  AND EXISTS (
    SELECT 1 FROM events e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
      AND e.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'speaker-photos'
  AND EXISTS (
    SELECT 1 FROM events e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
      AND e.organization_id = get_user_organization(auth.uid())
  )
);
```
Adicional: definir `file_size_limit = 2MB` y `allowed_mime_types = {image/jpeg,image/png,image/webp}` en el bucket para enforcement server-side.

#### 2.2 SessionModal — mobile-first y responsive

**Archivo**: `src/components/admin/agenda/SessionModal.tsx`
- `DialogContent`: cambiar a `w-[calc(100%-1rem)] max-w-lg max-h-[92vh] sm:max-h-[90vh] p-4 sm:p-6`.
- Convertir todos los `grid grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2`. Aplica a:
  - bloque fecha + horas (línea 216)
  - sub-grid de horas dentro (línea 224) — pasa a 2 cols siempre porque van juntas, pero con gap-2.
  - speaker name + bio (línea 259)
  - requires_checkin + capacity (línea 294)
- `SpeakerPhotoUpload`: cambiar `flex items-center gap-3` → `flex flex-col sm:flex-row items-start sm:items-center gap-3`.
- Footer: botones full-width en mobile (`flex-col sm:flex-row`, `w-full sm:w-auto`).

#### 2.3 TimePicker — corregir guiones superpuestos al icono

**Archivo**: `src/components/admin/agenda/TimePicker.tsx`

Causa: el `<input type="time">` nativo muestra "HH:MM" + indicador del navegador y el botón Clock se solapa porque está absoluto sobre la zona del indicador.

Fix: ocultar el botón nativo del input y mantener solo el icono custom como trigger.
- Añadir CSS global en `src/index.css`:
  ```css
  input[type="time"]::-webkit-calendar-picker-indicator { display: none; }
  input[type="time"]::-webkit-clear-button { display: none; }
  ```
- En `TimePicker.tsx`: aumentar `pr-10` → `pr-9`, ajustar el botón Clock para que quede dentro del padding sin pisar los dígitos (`right-2 h-6 w-6`).

#### 2.4 SortableSessionRow — versión móvil compacta con menú engranaje

**Archivo**: `src/components/admin/agenda/SortableSessionRow.tsx`
- En mobile (`< sm`): mostrar solo grip + `start_time` + `title` + un único botón engranaje (`Settings` icon) que abre `DropdownMenu` con: Editar, Duplicar, Archivar, Eliminar.
- En desktop (`sm+`): mantener layout actual completo con badges y los 4 iconos de acción.
- Esto se hace con clases responsive: `<div className="hidden sm:flex ...">` para el bloque actual de 4 botones, y agregar un `<div className="flex sm:hidden">` con el `DropdownMenu`.
- También ocultar contadores de Star/Users en mobile (ya están con `hidden sm:flex`, ok).
- Ocultar location badge y speaker en mobile para limpieza visual: `<div className="hidden sm:flex flex-wrap items-center gap-2 mt-1">`.

#### 2.5 Estados visuales (programado / cancelado / finalizado) — Híbrido

**Decisión híbrida**: cálculo automático por hora + override manual `cancelled`.

**Migración SQL**: agregar columna `status` a `event_activities`:
```sql
ALTER TABLE event_activities
  ADD COLUMN IF NOT EXISTS status text DEFAULT NULL
  CHECK (status IN ('cancelled') OR status IS NULL);
```
Solo se persiste `cancelled` (manual). Programado/finalizado se calculan en el cliente comparando `scheduled_date + end_time` con `now()`.

**Helper** en `src/lib/session-status.ts`:
```ts
export type SessionStatus = 'scheduled' | 'finished' | 'cancelled';
export function getSessionStatus(s: { status?: string|null; scheduled_date: string; end_time: string|null }): SessionStatus { ... }
```

**UI**:
- En `SortableSessionRow`: dot de 8px en esquina superior derecha de la card:
  - `scheduled` → verde `bg-emerald-500`
  - `cancelled` → rojo `bg-red-500`
  - `finished` → naranja `bg-orange-500`
- En `SessionModal`: agregar un `Switch` "Marcar como cancelada" que escribe `status='cancelled'` o `null`.
- Actualizar `SessionFormData` en `src/services/admin-agenda.service.ts` y los hooks para enviar `status`.
- Tooltip en el dot con texto traducido.

---

### 3) DOCUMENTOS

**Archivo**: `src/pages/admin/Documents.tsx`

#### 3.1 Quitar botones de la barra superior
Eliminar (líneas ~330-365):
- Botón **"Verificar completitud"** (`setCompletenessOpen`)
- Botón **"Exportar archivos"** (`handleExportXls`)
- Botón **"Exportar todo ZIP"** (`handleBulkExportZip`)

Eliminar imports/handlers/estado no usados:
- `CompletenessCheckModal`, `setCompletenessOpen`, `completenessOpen`
- `handleExportXls`, `handleBulkExportZip`, `bulkExportProgress`
- imports `JSZip`, `writeExcelFile`, `FileSpreadsheet`, `Archive`, `ClipboardCheck`

#### 3.2 Quitar icono Download por fila
- En la tabla (línea 514-521): eliminar el `Tooltip` con el botón Download por fila. Dejar solo: Preview, Editar, Eliminar.
- El handler `handleDownload` queda sin uso → eliminar.

#### 3.3 Carga masiva (PDF/PPT) — Modal separado

**Nuevo archivo**: `src/components/admin/documents/BulkUploadDocumentsModal.tsx`
- Drag & drop multi-archivo + input `multiple`.
- Acepta extensiones `.pdf, .ppt, .pptx`.
- Lista de archivos seleccionados con campos editables:
  - Título (default = nombre sin extensión)
  - Sesión asociada (Select, default "Sin sesión")
  - Botón quitar fila
- Validación por archivo: tipo + tamaño ≤ 50MB.
- Botón "Subir todos" → loop secuencial con `adminDocumentsService.uploadFile` + `createDocument`, y barra de progreso `current/total`.
- Maneja errores por archivo sin abortar el lote; al final toast con `{success, failed}`.
- Mobile-first: `DialogContent w-[calc(100%-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto`, lista en cards apiladas.

**Bucket fix**: agregar a `event-documents.allowed_mime_types` el MIME del PPT antiguo:
```sql
UPDATE storage.buckets
SET allowed_mime_types = allowed_mime_types || ARRAY['application/vnd.ms-powerpoint']
WHERE id = 'event-documents';
```

**Toolbar Documents.tsx**: añadir botón "Carga masiva" junto al "Subir documento" actual, abriendo el nuevo modal.

#### 3.4 Previsualización — corregir flujo

**Archivo**: `src/components/admin/documents/DocumentPreviewModal.tsx`

Problema actual: el switch usa `document.file_type` sin normalizar; archivos guardados con extensión `jpeg` no caen en `PREVIEWABLE_IMAGE` (sí está) pero el `getFileType` durante upload mapea `jpeg → jpg`, así que en BD queda `jpg`. Posibles fallos reales:
- PDFs: el iframe abre la URL firmada de Supabase. Esto puede ser bloqueado por header `Content-Disposition: attachment` que devuelve Supabase Storage por defecto al usar `createSignedUrl` sin `download` flag explícito — pero en realidad sí se renderiza inline en la mayoría de browsers; verificar en preview real.
- Para PDFs cambiar a `<object data={url} type="application/pdf">` con fallback `<embed>` para mejor compatibilidad (especialmente Safari móvil).
- Añadir manejo de error del iframe/object: si falla cargar, mostrar el mismo fallback "no soportado" con botón Descargar.
- Normalizar `ext` con la extensión real del `file_path` además del `file_type` para casos legacy.

Cambios:
```tsx
const ext = ((document.file_type ?? document.file_path.split('.').pop() ?? '')).toLowerCase();
// PDF render con object + fallback
{isPdf && (
  <object data={url} type="application/pdf" className="w-full h-[70vh]">
    <iframe src={url} className="w-full h-[70vh]" title={document.title} />
  </object>
)}
```

---

### 4) i18n
Agregar todas las claves nuevas en `src/locales/es/admin.json` y `en/admin.json`:
- `attendees.detail.regenerateCredentialDialog.*`
- `agenda.sessionModal.statusCancelled`, `agenda.status.{scheduled,cancelled,finished}`
- `agenda.actions.menu`
- `documents.bulkUpload.*` (title, dropHint, fileCount, uploadAll, uploading, success, errors, removeFile)

---

### Migraciones SQL (resumen — 3 migraciones)

1. **Fix RLS speaker-photos** (P0 — desbloquea upload).
2. **Bucket constraints**: tamaño/MIMEs en `speaker-photos`; añadir `application/vnd.ms-powerpoint` a `event-documents`.
3. **Agenda status**: `ALTER TABLE event_activities ADD COLUMN status text NULL` + check.

---

### Orden de implementación (Backend-First)
1. Migración RLS speaker-photos + buckets.
2. Migración columna `status` en event_activities.
3. Helper `session-status.ts` + tipos en service.
4. Componentes UI (modal regenerar, SessionModal responsive, TimePicker, SortableSessionRow móvil + dot estado, Documents toolbar limpia, BulkUploadDocumentsModal, DocumentPreviewModal robusto).
5. i18n.

