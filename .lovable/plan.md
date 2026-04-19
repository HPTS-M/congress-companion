

## Plan · Importación con upsert + resolución manual de duplicados

### 1 · Servicio `bulkUpsertAttendees`
**`src/services/admin-attendees.service.ts`**

Nuevo método que recibe `eventId`, filas del CSV y `resolutions` (mapa `csvRow → action`).

```ts
type Resolution = 
  | { action: 'create' }
  | { action: 'update', targetAttendeeId: string }
  | { action: 'skip' };

bulkUpsertAttendees(eventId, rows, resolutions): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}>
```

Lógica:
- Pre-validar unicidad de `external_credential_code` dentro del evento (excluyendo el target en updates)
- Si conflicto → registrar error, no aplicar
- INSERT/UPDATE selectivo (jamás tocar `credential_code`, `access_code_hash`, `registration_status`, `user_id`)

### 2 · Hook
**`src/hooks/useAdminAttendees.ts`**

`useBulkUpsertAttendees()` con invalidación de queries y limpieza de SW cache (mismo patrón que `useBulkCreateAttendees`).

### 3 · Detección previa de matches
**`src/components/admin/attendees/ImportCsvModal.tsx`**

Después del parseo:
1. Para cada fila con email → consultar BD: `SELECT id, full_name, credential_code, created_at FROM attendees WHERE event_id = X AND lower(email) = Y`
2. Clasificar:
   - 0 matches → `new` (INSERT)
   - 1 match → `single-match` (UPDATE auto si toggle activo)
   - 2+ matches → `ambiguous` (requiere resolución manual)

### 4 · UI en preview
**`ImportCsvModal.tsx`**

- Nuevo `Checkbox`: "Actualizar asistentes existentes (por email)" — visible solo si hay `single-match` o `ambiguous`
- Resumen del preview muestra:
  - X nuevos
  - Y actualizables (1 match)
  - Z requieren resolución (multi-match)
- Botón "Resolver duplicados" abre modal si Z > 0
- Botón "Confirmar importación" deshabilitado mientras haya ambiguos sin resolver

### 5 · Modal nuevo `ResolveAmbiguousImportModal.tsx`
**`src/components/admin/attendees/ResolveAmbiguousImportModal.tsx`**

Lista cada email ambiguo con:
- Datos de la fila CSV (nombre, código del congreso entrante)
- Cards con cada candidato existente: nombre + `credential_code` interno + fecha registro + último login
- Radio group por fila: `[ ] Candidato 1 · [ ] Candidato 2 · [ ] Crear nuevo · [ ] Saltar`
- Validación: todos resueltos antes de aplicar

### 6 · Renombrar visible "External" → "Congress code"
Cambios solo de label (campo BD intacto):
- `EventSettingsCard.tsx`: toggle "Códigos del congreso"
- `AttendeesTable.tsx`: columna "Código del congreso"
- `AttendeeDetailDrawer.tsx`, `NewAttendeeModal.tsx`: input "Código del congreso"
- `MyProfile.tsx`: nueva fila condicional con icono `BadgeCheck` (solo si toggle activo + valor)
- Plantilla CSV descargable: header "Código del congreso"

### 7 · Locales
**`es/admin.json`, `en/admin.json`, `es/common.json`, `en/common.json`**

Reemplazar/agregar:
- `settings.externalCredentials` → "Códigos del congreso" / "Congress codes"
- `settings.externalCredentialsDescription` → "Identificadores entregados por la organización del congreso (cédula, ID corporativo). Únicos por asistente."
- `attendees.congressCode` / `congressCodePlaceholder`
- `attendees.import.updateExisting` / `updateExistingDescription`
- `attendees.import.summary.{new,updatable,ambiguous,updated,skipped}`
- `attendees.import.resolve.{title,description,createNew,skip,confirm}`
- `profile.congressCode`

### Verificación end-to-end
1. Activar toggle "Códigos del congreso" en `/admin/event-config`
2. Subir CSV en importador → marcar "Actualizar existentes"
3. Preview muestra: X nuevos, Y updatables, Z ambiguos
4. Modal de resolución → elegir candidato por cada email duplicado
5. Confirmar → resumen "X creados · Y actualizados · Z resueltos · W saltados"
6. Query BD: `SELECT external_credential_code FROM attendees WHERE email = '...'` → ya no NULL
7. Login como ese attendee → "Mi Perfil" muestra "Código del congreso"
8. Validar que NO se modificaron `credential_code`, `access_code_hash`, `user_id`, `registration_status`

### Mejores prácticas aplicadas
- ✅ Backwards compatible (campo BD `external_credential_code` intacto)
- ✅ Sin UNIQUE constraint forzado (respeta tu decisión)
- ✅ Resolución manual obligatoria para multi-match (cero auto-magia destructiva)
- ✅ Validación de unicidad de código antes de UPDATE
- ✅ i18n completo
- ✅ Invalidación correcta de TanStack Query + SW cache
- ✅ Nunca toca PII sensible en updates

