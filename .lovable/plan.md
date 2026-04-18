

## Plan: Credenciales + Módulo Documentos

### PARTE 1 · Diagnóstico y arreglo del flujo de credenciales

#### Problema raíz identificado

Existen **dos códigos** y se confunden entre sí:

| Código | Columna DB | Propósito | Generado por |
|---|---|---|---|
| `credential_code` | `attendees.credential_code` | Display + QR (formato `MCONG-YYYYMMDD-XXXXXXXX`) | Trigger `auto_generate_credential` y RPC `create_attendee_credential` |
| `access_code` (8 chars) | NO se almacena en plano; solo `access_code_hash` (bcrypt) | **Login** real del asistente (lo que debe escribir en pantalla de ingreso) | Edge Function `send-invitation-email` |

#### Bugs detectados

1. **RPC `create_attendee_credential` está rota**: tiene una variable local llamada igual que la columna (`credential_code`), por lo que `UPDATE attendees SET credential_code = credential_code` es ambiguo. Causa el error al regenerar.
2. **"Regenerar código" sólo regenera el display**, no el `access_code_hash`. Aunque arreglemos el RPC, el asistente seguirá sin poder ingresar con el código nuevo porque su hash de login no cambió.
3. **Asistentes sin invitación enviada (`has_hash:false`) no pueden ingresar**: 6 de 10 asistentes en el evento están en este estado. La pantalla de login parece "no funcionar" porque su credential_code (display) no es el access_code de login.
4. **Confusión UX**: el botón dice "Regenerar código" pero no aclara qué código (display vs login).

#### Cambios propuestos

**A. Arreglar RPC `create_attendee_credential` (migración SQL)**
- Renombrar variable interna a `_new_code` para eliminar ambigüedad.
- Devolver el código generado correctamente.

**B. Nuevo RPC `regenerate_attendee_access_code(_attendee_id)` (no implementado todavía — pendiente)**
- Genera nuevo access code de 8 chars (mismo charset sin O/0/I/1).
- Hashea con bcrypt vía Edge Function (no se puede bcrypt en RPC PostgreSQL fácilmente).
- Limpia `last_session_id` para forzar re-login.
- Retorna el código en plano una sola vez (para mostrar al admin).

**C. Nueva Edge Function `regenerate-access-code`**
- Endpoint admin-only (verifica rol).
- Genera código de 8 chars, lo hashea con bcrypt, actualiza `access_code_hash` + `invitation_sent_at` + limpia `last_session_id`.
- Retorna `{ access_code: "ABCD2345" }` para que el admin lo copie/envíe.
- Opcional: parámetro `send_email=true` para reenviar correo automáticamente.

**D. Refactor del Drawer de Asistentes (`AttendeeDetailDrawer.tsx`)**
- Separar visualmente en dos bloques claros:
  - **"Código de credencial (Display/QR)"** — botón `Regenerar` que llama al RPC arreglado.
  - **"Código de acceso (Login)"** — botón `Regenerar código de acceso` que llama a la nueva Edge Function, muestra el código generado en un `AlertDialog` con botón "Copiar" y "Enviar por correo".
- El botón actual `Enviar credenciales` queda como está (genera + envía email).
- Tooltips en cada botón explicando para qué sirve.

**E. QA de login con asistente regenerado**
- Probar: regenerar acceso → copiar código → probar login en `/{event_code}` con el nuevo código.
- Validar que `last_session_id` se limpia y permite ingreso aunque hubiera sesión activa previa.

---

### PARTE 2 · Módulo Documentos — Mejoras

#### 2.1 Carga y gestión

| Cambio | Detalle |
|---|---|
| Ampliar formatos aceptados | PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, **ZIP**, **PNG/JPG**, **MP4**, **TXT/CSV** |
| Constante `ACCEPTED` | Pasar a array tipado: `['pdf','pptx','docx','xlsx','zip','png','jpg','jpeg','mp4','txt','csv']` |
| Mapa `getFileType()` | Ampliar para devolver tipo correcto según extensión |
| Iconos por tipo | Añadir colores e iconos para zip (gris), imágenes (índigo), video (rosa), texto (slate) |
| **Validación de duplicados** | Antes de crear el documento, query a `documents` por `event_id + title` (case-insensitive) o por hash de archivo. Si existe → mostrar diálogo "Ya existe un documento con ese título / archivo similar. ¿Reemplazar / Renombrar / Cancelar?" |
| Validación de completitud (`CompletenessCheckModal`) | Aceptar todos los nuevos tipos en el campo `tipo` de la plantilla XLS de referencia |

#### 2.2 Interacción y visualización

| Cambio | Detalle |
|---|---|
| **Refresco inmediato** | Tras subir/editar/eliminar, además de `invalidateQueries` hacer `refetch()` explícito. Ya está parcialmente implementado pero hay que asegurar que después de `onUploaded` se ejecute. |
| **Botón "Actualizar"** | Añadir botón en header con ícono `RefreshCw` que dispara `qc.invalidateQueries(['admin-documents', eventId])` + spinner mientras `isFetching`. |
| **Tooltips** | Envolver los botones de acción (Descargar, Editar, Eliminar, Subir, Índice, Completitud, Exportar, Actualizar) con `<Tooltip>` de shadcn. Usar i18n keys nuevas `documents.tooltip.*`. |
| **Previsualización** | Nuevo componente `DocumentPreviewModal`: <br>• PDF → iframe con signed URL.<br>• Imágenes → `<img>` con signed URL.<br>• Video → `<video controls>` con signed URL.<br>• PPT/DOC/XLS/ZIP → mensaje "Vista previa no disponible. Usa Descargar." con botón directo.<br>Botón "Ver" (ícono `Eye`) en la fila junto a Descargar. |

#### 2.3 Descargas y exportación

| Cambio | Detalle |
|---|---|
| **Corregir descarga desde rejilla** | El `handleDownload` actual abre signed URL en `window.open`, pero algunos navegadores bloquean si tarda. Cambiar a: crear `<a href download>` programático tras obtener signed URL, así fuerza descarga vs apertura. |
| **Restricción de descarga** | Añadir nueva config `documents_download_enabled` (boolean) en `events.settings`. Cuando es `false`: ocultar botón Descargar en `attendee/Documents.tsx` (ya existe el patrón `qrEnabled`). En admin sí se muestra siempre. Toggle en `EventSettingsCard` siguiendo patrón de QR. |
| **Exportar listado a XLS** | Reemplazar `handleExportList` (CSV) por `writeExcelFile` de `@/lib/excel`. Columnas: Título, Tipo, Sesión, Tamaño, Fecha, Descargas. |
| **Exportación masiva XLS + archivos** | Nueva acción "Exportar todo (ZIP)": <br>1. Generar XLS con metadatos.<br>2. Descargar cada archivo del bucket.<br>3. Empaquetar todo en un ZIP con `jszip` (ya común en frontend, añadir si no está).<br>4. Ofrecer descarga del ZIP `documentos-{event_code}-{date}.zip`.<br>Mostrar progreso (0/N) durante el proceso. |

---

### Archivos a modificar / crear

#### Backend (DB + Edge Functions)
- **Migración SQL**: arreglar `create_attendee_credential` (renombrar variable).
- **Migración SQL**: ampliar columna `documents.file_type` no necesaria (es `text`); pero añadir índice opcional `(event_id, lower(title))` para validar duplicados rápido.
- **Nueva Edge Function** `supabase/functions/regenerate-access-code/index.ts`.

#### Frontend — Credenciales
- `src/services/admin-attendees.service.ts` — nuevo método `regenerateAccessCode(attendeeId, sendEmail)`.
- `src/hooks/useAdminAttendees.ts` — nuevo hook `useRegenerateAccessCode`.
- `src/components/admin/attendees/AttendeeDetailDrawer.tsx` — separar en dos bloques (display vs access), añadir tooltips, dialog para mostrar código nuevo.
- i18n: `attendees.detail.accessCode.*`, `attendees.detail.accessCodeRegenerated`, `attendees.detail.copyCode`, etc.

#### Frontend — Documentos
- `src/components/admin/documents/UploadDocumentModal.tsx` — ampliar formatos, validar duplicados.
- `src/components/admin/documents/CompletenessCheckModal.tsx` — aceptar nuevos tipos.
- **Nuevo** `src/components/admin/documents/DocumentPreviewModal.tsx`.
- `src/pages/admin/Documents.tsx` — botón Actualizar, tooltips, exportar XLS, exportar masivo ZIP, botón Ver.
- `src/services/admin-documents.service.ts` — método `checkDuplicate(eventId, title)`, método `bulkDownloadAsZip(docs)`.
- `src/components/admin/EventSettingsCard.tsx` — toggle `documents_download_enabled`.
- `src/pages/attendee/Documents.tsx` — ocultar botón descargar cuando `documents_download_enabled === false`.
- `src/hooks/useEventSettings.ts` (si existe) o `useEvent.ts` — exponer `documentsDownloadEnabled`.
- i18n: `documents.tooltip.*`, `documents.duplicate.*`, `documents.preview.*`, `documents.refresh`, `documents.bulkExport`, `settings.documentsDownload*`.
- **Dependencia nueva**: `jszip` (para exportación masiva).

---

### Restricciones honradas

- TypeScript strict, sin `any` (excepto donde ya existe en código legado y no aplica al cambio).
- Mobile-first preservado.
- Cero strings hardcodeados (i18n es/en).
- Cumple `notification-system-logic`, `realtime-cleanup-pattern`.
- Edge Functions con bcrypt SÍNCRONO (memoria `bcrypt-edge-runtime-limitations`).
- RLS no requiere cambios — la nueva Edge Function usa service role + verifica rol admin.
- Bucket `event-documents` permanece privado, signed URLs siempre.

### Orden de ejecución sugerido

1. **Credenciales primero** (alta prioridad — bloquea ingreso de asistentes):
   - Migración fix RPC + nueva Edge Function `regenerate-access-code` + UI drawer.
2. **Documentos** (en una segunda iteración o sub-divididos):
   - 2A: formatos + duplicados + tooltips + botón actualizar.
   - 2B: previsualización + descarga corregida.
   - 2C: exportación XLS + exportación masiva ZIP + restricción de descarga.

¿Apruebas este plan completo o prefieres dividirlo en fases (1 primero, luego 2A/2B/2C)?

