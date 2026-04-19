

Agrego la Fase 3 al plan vigente. Reemplazo la sección "Plan de implementación" para insertarla como nuevo paso explícito.

## Cambio al plan

Inserto **Paso 5-bis · Plantilla descargable** entre el Paso 5 (Modal de importación) y el Paso 6 (Modal de errores). El resto del plan no cambia.

### Paso 5-bis · Actualización de la plantilla descargable (OBLIGATORIO)

**Ubicación:** función `downloadTemplate()` en `src/components/admin/attendees/ImportCsvModal.tsx`.

**Cambio:** reemplazar las 4 columnas actuales (`full_name`, `email`, `specialty`, `institution`) por estas **6 columnas en este orden exacto** (encabezados en español, tal como pide el usuario):

| # | Header (Excel) | Key interno | Tipo | Ejemplo |
|---|---|---|---|---|
| 1 | Nombre completo | `full_name` | string | Dr. Juan Pérez |
| 2 | Email | `email` | string | juan@ejemplo.com |
| 3 | Código credencial | `external_credential_code` | string | EXT-001234 |
| 4 | Especialidad | `specialty` | string | Cardiología |
| 5 | Institución | `institution` | string | Hospital General |
| 6 | Estado | `registration_status_id` | number (1\|2\|3) | 1 |

**Filas de ejemplo (2):** una con estado 1 (confirmado) y otra con estado 2 (pendiente), para que el admin entienda el mapeo numérico.

**Archivo descargado:** `plantilla-asistentes.xlsx` (se mantiene el nombre).

**Mapeo bidireccional encabezado → key interno** debe quedar centralizado en `src/lib/import-validators.ts` (creado en Paso 3) para que el parser acepte los headers en español de la plantilla nueva pero también tolere los anteriores en inglés (retro-compatibilidad para archivos viejos):

```ts
const HEADER_ALIASES = {
  full_name: ['Nombre completo', 'nombre_completo', 'full_name', 'nombre'],
  email:     ['Email', 'email', 'correo'],
  external_credential_code: ['Código credencial', 'codigo_credencial', 'credential_code'],
  specialty: ['Especialidad', 'specialty', 'especialidad'],
  institution: ['Institución', 'institution', 'institucion'],
  registration_status_id: ['Estado', 'estado', 'status'],
};
```

**Notas operativas:**
- La columna 3 (`Código credencial`) corresponde al `external_credential_code` introducido en Paso 1. Si el toggle `external_credentials_enabled` está OFF, esa columna se ignora silenciosamente al importar (pero sigue presente en la plantilla para coherencia).
- La columna 6 (`Estado`) acepta solo `1`, `2`, `3` y se mapea a `confirmed | pending | cancelled` por el validador (Paso 3). Si viene vacío, default = `2` (pendiente).
- Anchos de columna sugeridos: 30, 30, 22, 20, 25, 10.

---

## Plan completo actualizado (orden de ejecución)

1. Paso 1 · Migración BD (`external_credential_code` + índice único parcial)
2. Paso 2 · Tipos + toggle en `EventSettingsCard`
3. Paso 3 · `src/lib/import-validators.ts` (Zod, regex, mapeo estado, header aliases)
4. Paso 4 · Servicio: `getExistingExternalCodes` + extender `bulkCreateAttendees`
5. Paso 5 · Reescritura del `ImportCsvModal` (parser tolerante, validación acumulativa)
6. **Paso 5-bis · Plantilla descargable nueva (6 columnas en español)** ← agregado
7. Paso 6 · `ImportErrorsModal` (tabla errores + exportar Excel + decisión NO APLICA)
8. Paso 7 · UI tabla y `NewAttendeeModal` con campo credencial externa
9. Paso 8 · Edge Function `verify-access-code` acepta credencial externa
10. Paso 9 · i18n (es/en) — incluir claves para los nuevos headers de la plantilla
11. Paso 10 · Checklist de verificación end-to-end

Tras tu aprobación cambio a modo default y ejecuto Pasos 1 → 11.

