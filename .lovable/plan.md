

## Plan: Mejoras al Módulo Patrocinadores

### Diagnóstico

**Bugs/limitaciones detectados:**
1. `SponsorModal` no valida WhatsApp (acepta cualquier string), email, URL, ni longitud mínima. No verifica duplicados.
2. Crear/editar es lento porque sube logo y materiales **secuencialmente** y luego hace 1 INSERT — debería paralelizarse y subir solo si hay archivo.
3. La rejilla no refresca al instante después de `onSaved` (el comentario `/* invalidated by hook */` es engañoso: la mutation invalida, pero `SponsorModal` llama directamente a `adminSponsorsService` sin pasar por la mutation, así que **no invalida nada**).
4. El pop-up `SponsorModal` no preview del logo ni del PDF ya cargado al editar — el admin no ve qué tiene.
5. `ImportSponsorsModal` no valida duplicados contra los existentes en la BD (solo crea sin chequear).
6. Detail Drawer ya tiene leads + export, pero falta filtro/búsqueda dentro de la lista de leads y mostrar el WhatsApp del lead.

---

### PARTE 1 · Validaciones y Creación

**A. Esquema Zod en `SponsorModal`**
- `name`: requerido, 2–100 chars.
- `whatsapp`: opcional pero si se da, regex `/^\+?[1-9]\d{7,14}$/` (E.164, 8–15 dígitos, opcional `+`). Auto-limpia espacios/guiones antes de validar.
- `contact_email`: opcional, formato email válido.
- `website_url`, `video_url`, `social_linkedin`, `social_instagram`: opcionales, formato URL válido (acepta `@usuario` para Instagram).
- `description`: máx 500 chars.
- Mostrar errores inline bajo cada campo.

**B. Validación de duplicados al crear**
- Antes de `create`, query `sponsors` por `event_id + lower(name)`.
- Si existe → diálogo "Ya existe un patrocinador con ese nombre. ¿Continuar / Editar el existente / Cancelar?"

**C. Optimización de tiempos**
- Subir `logoFile` y `materialsFile` con `Promise.all` en paralelo.
- Saltar upload si no hay archivo nuevo (ya pasa, mantener).
- Optimistic update vía mutation: `useAdminSponsors` ya devuelve `createSponsor`/`updateSponsor` mutations — refactor `SponsorModal` para usar la mutation (que invalida) en vez de llamar al servicio directo.

**D. Migración SQL**
- Índice `CREATE INDEX idx_sponsors_event_lower_name ON sponsors (event_id, lower(name))` para acelerar duplicados.

---

### PARTE 2 · Visualización e Interfaz

**A. Refresco inmediato de rejilla**
- `SponsorModal`: usar `createSponsor`/`updateSponsor` mutations del hook (invalida queryKey automáticamente).
- `ImportSponsorsModal`: tras importar exitosamente, invalidar `['admin-sponsors', eventId]` vía `useQueryClient`.
- Eliminar comentarios engañosos `/* invalidated by hook */`.

**B. Alineación del pop-up**
- `SponsorModal`: reorganizar en 2 secciones colapsables o pestañas: **"Información básica"** (nombre, nivel, categoría, descripción, stand, logo) y **"Contacto y materiales"** (web, email, WhatsApp + msg, video, redes, materials PDF).
- Asegurar `gap-4` consistente, labels alineadas, file uploads con preview (logo thumbnail 64x64, materials nombre + tamaño).
- Al editar, mostrar logo actual + botón "Reemplazar/Eliminar" y nombre del PDF actual.

**C. Previsualización de material**
- Nuevo `SponsorMaterialPreviewModal` (similar a `DocumentPreviewModal` ya existente):
  - PDF → iframe con signed URL.
  - Botón "Descargar".
- Integrar en `SponsorDetailDrawer` tab "Info": cuando `materials_url` existe, botón "Vista previa" además del icono.
- Reutilizable también en el `SponsorModal` para previsualizar al editar.

---

### PARTE 3 · Gestión de Leads e Importación

**A. Importación XLS con validación de duplicados**
- `ImportSponsorsModal`: antes del bulk insert, fetchear sponsors actuales (`adminSponsorsService.getAll`) y marcar filas duplicadas por nombre case-insensitive.
- Añadir columna **"Estado"** en la preview: `Nuevo` / `Duplicado` / `Inválido`.
- Permitir al admin elegir estrategia: **"Saltar duplicados"** (default) o **"Actualizar existentes"** (toggle).
- Si "Actualizar", llamar `update` en lugar de `create` para los duplicados.
- Validación WhatsApp/email también en import (extender `validateSponsorRows`).

**B. Mejoras a Gestión de Leads**
- En `SponsorDetailDrawer` tab "Leads":
  - Añadir input de búsqueda (filtra por nombre/especialidad/institución).
  - Mostrar email + WhatsApp de cada lead (datos ya disponibles en `attendees`).
  - Botón "Contactar por email" (abre `mailto:`) y "WhatsApp" (abre `wa.me/...`) por lead.
  - Indicador visual si el lead ya fue contactado (campo `contacted_at` en `sponsor_leads` — requiere migración mínima).
- Export ya existe, solo añadir columnas: `whatsapp`, `telefono`.

**C. Migración mínima opcional**
- `ALTER TABLE sponsor_leads ADD COLUMN contacted_at timestamptz` para tracking.
- RPC `mark_lead_contacted(_lead_id)` con check de organización.

---

### Archivos a modificar / crear

**Backend (DB):**
- Migración: índice `idx_sponsors_event_lower_name`, columna `sponsor_leads.contacted_at`, RPC `mark_lead_contacted`.

**Frontend — Validaciones y modal:**
- `src/components/admin/sponsors/SponsorModal.tsx` — Zod, validación inline, paralelización uploads, previews de archivos actuales, uso de mutations.
- `src/services/admin-sponsors.service.ts` — método `checkDuplicate(eventId, name)`.
- `src/hooks/useAdminSponsors.ts` — exponer mutations correctamente (ya están, solo asegurar uso).

**Frontend — Previsualización:**
- **Nuevo** `src/components/admin/sponsors/SponsorMaterialPreviewModal.tsx`.
- `src/components/admin/sponsors/SponsorDetailDrawer.tsx` — botón "Vista previa", búsqueda de leads, contactar por email/WhatsApp, badge `contacted`.

**Frontend — Importación:**
- `src/components/admin/sponsors/ImportSponsorsModal.tsx` — pre-fetch sponsors, columna Estado, toggle estrategia, invalidate al terminar.
- `src/services/admin-sponsors-excel.service.ts` — añadir validación WhatsApp/email en `validateSponsorRows`, exponer flag `isDuplicate`.

**Frontend — Página:**
- `src/pages/admin/Sponsors.tsx` — quitar comentarios engañosos.

**Frontend — Leads service:**
- `src/services/sponsor-leads.service.ts` — método `markAsContacted(leadId)`.

**i18n (es/en `admin.json`):**
- `sponsors.validation.*` (whatsappFormat, emailFormat, urlFormat, nameRequired, nameMinLength, descriptionMax)
- `sponsors.duplicate.*` (foundTitle, foundMessage, continueAnyway, editExisting, cancel)
- `sponsors.preview.*` (title, notSupported, download)
- `sponsors.import.duplicateStrategy*` (skip, update, label)
- `sponsors.import.statusNew`, `statusDuplicate`, `statusInvalid`
- `sponsors.leads.search`, `sponsors.leads.contactEmail`, `sponsors.leads.contactWhatsapp`, `sponsors.leads.markContacted`, `sponsors.leads.alreadyContacted`

---

### Restricciones honradas

- TypeScript strict, sin `any`.
- Validación con Zod (ya recomendado en project-knowledge §10).
- `react-hook-form` opcional o `useState` + Zod manual (mantener consistencia con código existente: `useState` + validación manual con Zod schema).
- Mobile-first preservado (tabs/secciones colapsables en modal grande).
- Sin nuevas dependencias (Zod, ExcelJS, JSZip ya están).
- i18n completo es/en, sin hardcoded strings.
- RLS no requiere cambios (`sponsors` ya tiene admin policies; `sponsor_leads` igual).
- Bucket `event-sponsors` permanece privado, signed URLs.

### Orden de ejecución sugerido

1. **Backend**: índice + columna `contacted_at` + RPC.
2. **Validaciones modal** (Parte 1A–1C) + previsualización material (Parte 2C).
3. **Refresco rejilla + alineación pop-up** (Parte 2A–2B).
4. **Importación con duplicados** (Parte 3A).
5. **Gestión avanzada de leads** (Parte 3B).

¿Apruebas el plan completo o prefieres ejecutarlo por fases (1+2 primero, luego 3)?

