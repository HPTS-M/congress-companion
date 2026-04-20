

## Plan: Garantizar unicidad del código externo (1 código = 1 individuo)

### Estado verificado
- 0 duplicados de `external_credential_code` en toda la BD (consulta agrupada por evento devolvió vacío).
- Camino libre para aplicar el constraint sin limpieza previa.

### 1. Migración SQL — índice único parcial

```sql
CREATE UNIQUE INDEX IF NOT EXISTS attendees_event_external_code_unique
ON public.attendees (event_id, lower(trim(external_credential_code)))
WHERE external_credential_code IS NOT NULL
  AND trim(external_credential_code) <> ''
  AND deleted_at IS NULL;
```

**Por qué así:**
- **Parcial** (`WHERE … IS NOT NULL`): permite múltiples filas sin código (NULL no colisiona).
- **`lower(trim(...))`**: insensible a mayúsculas/espacios accidentales (consistente con el código actual que ya normaliza con `toUpperCase().trim()`).
- **Por `event_id`**: el mismo código puede repetirse entre eventos distintos (multi-tenant), pero NUNCA dentro del mismo evento.
- **`deleted_at IS NULL`**: un attendee soft-deleted libera su código para reutilización.

### 2. Confirmación: email puede repetirse
- No se agrega constraint sobre email. Hoy ya es warning informativo en el import → se mantiene.
- El check actual `block_blocking_emails` en `ImportCsvModal` ya trata duplicado de email como warning (no bloqueante). Confirmado consistente.

### 3. Refactor del flujo de import: matching por código externo

Cambios mínimos en 3 archivos para que el upsert use `external_credential_code` como llave de identidad cuando esté presente:

**`src/services/admin-attendees.service.ts`**
- Nueva función `lookupAttendeesByExternalCodes(eventId, codes)` que devuelve `Map<codeUpper, attendeeId>` (espejo de `lookupAttendeesByEmails`).
- Mantener `lookupAttendeesByEmails` como fallback.

**`src/components/admin/attendees/ImportCsvModal.tsx`**
- En el paso de detección de existentes:
  1. Si la fila trae `external_credential_code` → lookup por código externo. Si hay match único → resolución automática `update`. Sin ambigüedad posible (es único por definición).
  2. Si NO trae código externo → cae al flujo actual de match por email (con modal de ambiguos cuando aplique).
- Esto elimina el modal de "Resolver ambiguos" para filas que vienen con código externo.

**`src/services/admin-attendees.service.ts` — `bulkUpsertAttendees`**
- La validación actual de duplicados en batch + en BD (líneas 541-603) ya cubre la regla a nivel app. Se mantiene como capa rápida + el constraint UNIQUE es la red de seguridad final.
- Mejorar mensaje de error: si el `INSERT` falla por violación del índice único nuevo (código `23505`), mapear a `errors[].reason = 'duplicate_external_code'` con i18n key amigable.

### 4. UI — formulario manual (`NewAttendeeModal.tsx`)
- Hoy ya valida duplicados via `useExistingExternalCodes` (línea 152-204). Se mantiene.
- Agregar manejo de error 23505 en `useCreateAttendee`/`useUpdateAttendee` por si hay race condition entre validación previa y el INSERT.

### 5. Traducciones
Agregar a `src/locales/{es,en}/admin.json`:
- `attendees.errors.duplicateExternalCode`: "El código externo {{code}} ya está asignado a otro asistente en este evento."
- `attendees.import.matchedByExternalCode`: "{{count}} filas vinculadas automáticamente por código externo."

### Resumen de archivos tocados
1. **Migración nueva** — índice único parcial.
2. `src/services/admin-attendees.service.ts` — nueva función lookup + manejo error 23505.
3. `src/components/admin/attendees/ImportCsvModal.tsx` — preferir match por código externo.
4. `src/components/admin/attendees/NewAttendeeModal.tsx` — manejo error 23505.
5. `src/locales/es/admin.json` + `src/locales/en/admin.json` — nuevas keys.

### Garantías post-implementación
- Imposible (a nivel BD) tener 2 attendees activos con el mismo código externo en un mismo evento.
- Email duplicado sigue permitido sin warnings nuevos.
- Import de filas con código externo es 100% determinístico (sin modal de ambigüedad).
- Mismo código puede existir en eventos distintos.

