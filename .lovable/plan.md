

## Plan: Ajustes a módulos Patrocinadores y Logística

### Diagnóstico

**Patrocinadores (`/ACQFH-2026/admin/sponsors`)**
- WhatsApp es un único input que mezcla código de país + número, queda visualmente desordenado.
- Modal en pestaña "WhatsApp / Materials" usa `grid-cols-2` fijo en móvil, los inputs se aprietan.
- El botón refresh tiene spinner pero `isFetching` es `false` mientras se completan mutaciones (create/update) → no hay feedback visual durante esas operaciones.
- En el detail drawer, el botón "Vista previa" abre el modal correctamente, pero **no hay vista previa visible inline** (thumbnail/icono PDF) — el usuario debe hacer click extra. El modal de preview ya existe (`SponsorMaterialPreviewModal`) pero queremos un mini preview visible siempre.
- Bug PDF: `accept="application/pdf"` filtra por MIME pero algunos PDFs llegan con `file.type === ''` desde Windows → `validateFile` rechaza por `invalid_type` antes de subir. Hay que confiar en la extensión `.pdf` cuando MIME viene vacío.

**Logística (`/ACQFH-2026/admin/logistics`)**
- Existe `UNIQUE INDEX (event_id, lower(name))` pero el usuario quiere regla **(nombre + tipo + horario)**. El índice actual es **más estricto** que lo solicitado → hay que **reemplazarlo** por uno compuesto que considere los 3 campos.
- En la tabla solo se muestra el rango horario, no la fecha en que se canceló/completó → no se puede auditar visualmente.
- Placeholder del buscador dice "Buscar..." (genérico).

### Aclaraciones del usuario
- Duplicidad: **mismo nombre + mismo tipo + mismo rango horario** simultáneamente.
- Código de país WhatsApp: **selector con bandera** (lista de ~25 países comunes de LatAm/EU/US).

---

### Cambios concretos

#### A. Módulo Patrocinadores

**A1. Selector de país para WhatsApp** (nuevo componente `PhoneInputWithCountry.tsx`)
- Combobox con ~25 países: 🇨🇴 +57, 🇲🇽 +52, 🇺🇸 +1, 🇪🇸 +34, 🇦🇷 +54, 🇨🇱 +56, 🇵🇪 +51, 🇪🇨 +593, 🇻🇪 +58, 🇧🇷 +55, etc.
- Default: 🇨🇴 +57.
- El "+" siempre presente, no editable.
- Input separado al lado para los dígitos del número (mismas reglas: solo dígitos, máx 14 chars).
- Almacena la concatenación `+57` + `3001234567` → `+573001234567` en `whatsapp` (mismo formato que hoy).
- Al cargar un patrocinador existente: parsear el prefijo y ajustar el selector.

**A2. Responsividad del modal**
- Cambiar `grid-cols-2` por `grid-cols-1 sm:grid-cols-2` en las filas de inputs (Web/Email, WhatsApp/Mensaje, LinkedIn/Instagram).
- Aumentar `max-w-2xl` a `max-w-3xl md:max-w-2xl` para más respiro horizontal en escritorio.
- En móvil que el modal use `max-h-[90vh]` y respete `safe-area`.
- Logo y materiales: convertir las filas de botones en `flex-col sm:flex-row` para que en móvil no se rompan.

**A3. Animación de loading en refresh + create/update**
- En `Sponsors.tsx`, cambiar `disabled={isFetching}` y `animate-spin` para usar también `isCreating || isUpdating || isDeleting` del hook.
- Eso hace que el botón refresh gire automáticamente cuando cualquier mutación está en curso.

**A4. Previsualización de material en el detail drawer**
- En la sección "Información de contacto" del drawer, cuando exista `materials_url`, además del botón "Abrir vista previa", mostrar un **thumbnail clicable**:
  - Para PDF: ícono grande de PDF (rojo) + nombre del archivo + tamaño aprox.
  - Click sobre el thumbnail abre el modal de preview existente.
- Reutiliza `SponsorMaterialPreviewModal` (sin cambios).

**A5. Fix bug PDF al cargar/actualizar**
- En `lib/file-validation.ts`, cuando `file.type` sea string vacío (caso común en Windows/Edge), aceptar el archivo si la extensión está en `allowedExt`.
- Cambiar la línea `if (file.type && !allowedMime.includes(file.type))` para que el chequeo MIME sea **opcional** cuando MIME viene vacío y la extensión es válida.
- Adicionalmente, en `adminSponsorsService.uploadFile`: añadir `contentType: file.type || 'application/pdf'` (cuando prefix === 'materials') al `upload()` para garantizar que Supabase Storage no falle por MIME ausente.

---

#### B. Módulo Logística

**B1. Migration: nuevo unique index compuesto**
```sql
-- Quitar el index actual demasiado estricto
DROP INDEX IF EXISTS public.service_catalog_event_name_unique;

-- Nuevo: bloquea solo si coinciden los 3 campos a la vez
CREATE UNIQUE INDEX service_catalog_event_name_type_time_unique
  ON public.service_catalog (
    event_id, lower(name), service_type,
    COALESCE(valid_from, '00:00:00'::time),
    COALESCE(valid_until, '00:00:00'::time)
  );
```
Notas: `COALESCE` evita que dos servicios sin horario se consideren distintos. El servicio actualmente captura `error.code === '23505'` y emite el toast `logistics.duplicateName` — solo hay que actualizar el copy del mensaje de error a algo como **"Ya existe un servicio con el mismo nombre, tipo y horario en este evento"**.

**B2. Mostrar fecha de cancelación/finalización en la tabla**
- Agregar dos columnas opcionales (timestamps) a `service_catalog`:
  - `cancelled_at timestamptz`
  - `completed_at timestamptz`
- Trigger que setee `cancelled_at = now()` cuando `status` cambia a `'cancelled'`, y lo limpie al reactivar.
- Para `completed_at`: la vista `service_catalog_with_status` ya calcula `effective_status='completed'` cuando todos los tickets se usaron — podemos derivar `completed_at` como el `MAX(used_at)` de los `service_tickets` relacionados.
- En `getAll()` del service, incluir `cancelled_at` directo y traer `completed_at` calculado.
- En la tabla (`Logistics.tsx`), debajo del badge de estado mostrar la fecha en `text-xs text-muted-foreground`:
  - "Cancelado el 20 abr 14:30"
  - "Finalizado el 20 abr 18:00"
  - Programado: nada extra.

**B3. Placeholder del buscador**
- Cambiar `t('logistics.searchPlaceholder')` en `es/admin.json` y `en/admin.json`:
  - ES: "Buscar por nombre del servicio..."
  - EN: "Search by service name..."

---

### Detalles técnicos

**Migration SQL** (un solo archivo):
```sql
-- 1. Replace unique index
DROP INDEX IF EXISTS public.service_catalog_event_name_unique;
CREATE UNIQUE INDEX service_catalog_event_name_type_time_unique
  ON public.service_catalog (event_id, lower(name), service_type,
    COALESCE(valid_from, '00:00:00'::time),
    COALESCE(valid_until, '00:00:00'::time));

-- 2. cancelled_at column + trigger
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_service_cancelled_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_service_cancelled_at ON public.service_catalog;
CREATE TRIGGER trg_set_service_cancelled_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_service_cancelled_at();
```
`completed_at` se calcula on-the-fly en `getAll()` con `MAX(used_at)` de los tickets — sin migration necesaria.

**Archivos modificados**
- `src/components/admin/sponsors/PhoneInputWithCountry.tsx` (nuevo)
- `src/components/admin/sponsors/SponsorModal.tsx` (responsive + selector país + parser de prefijo)
- `src/components/admin/sponsors/SponsorDetailDrawer.tsx` (thumbnail PDF inline)
- `src/pages/admin/Sponsors.tsx` (animate-spin condicionado a `isCreating || isUpdating || isDeleting`)
- `src/lib/file-validation.ts` (aceptar MIME vacío si extensión válida)
- `src/services/admin-sponsors.service.ts` (`contentType` explícito en `uploadFile`)
- `src/pages/admin/Logistics.tsx` (mostrar fecha cancelación/finalización en celda de estado)
- `src/services/admin-logistics.service.ts` (incluir `cancelled_at` y calcular `completed_at`)
- `src/components/admin/logistics/ServiceModal.tsx` (sin cambios; el error 23505 ya se captura, solo cambia el copy)
- `src/locales/{es,en}/admin.json` (placeholder buscador, copy duplicateName, lista de países, labels nuevos)
- Migration `supabase/migrations/<ts>_logistics_unique_and_dates.sql`

**Validación post-deploy**
1. **Patrocinadores WhatsApp**: crear sponsor con 🇨🇴 +57, número 3001234567 → verificar que en BD queda `whatsapp = '+573001234567'`. Editar y comprobar que el selector vuelve a 🇨🇴 +57.
2. **Modal responsive**: abrir modal en viewport 375px → confirmar que inputs se apilan, no se cortan.
3. **Loading spinner**: crear/editar/eliminar un sponsor → confirmar que el botón refresh gira durante toda la mutación.
4. **Thumbnail PDF**: abrir detail drawer de sponsor con materiales → ver el thumbnail rojo grande, click → abre preview.
5. **PDF upload bug**: en Windows seleccionar un PDF y guardar → confirmar que ya no falla con "tipo inválido".
6. **Logística duplicidad**: crear servicio "Almuerzo / food / 12:00–13:00" → intentar duplicar exacto → toast de error. Crear "Almuerzo / food / 14:00–15:00" → permitido.
7. **Fecha estado**: cancelar un servicio → ver "Cancelado el DD/MM HH:mm" debajo del badge.
8. **Buscador**: confirmar el placeholder en es/en.

