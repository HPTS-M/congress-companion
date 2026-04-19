

## Estado actual de la implementación

Ya quedó construido en turnos anteriores:
- ✅ Servicio `bulkUpsertAttendees` + `lookupAttendeesByEmails`
- ✅ Hook `useBulkUpsertAttendees`
- ✅ Modal `ResolveAmbiguousImportModal`
- ✅ Renombrado a "Código del congreso" en `MyProfile`, `AttendeeDetailDrawer`, `NewAttendeeModal`
- ✅ Locales actualizados (es/en)

## Lo que falta para cerrar el flujo

El importador (`ImportCsvModal.tsx`) tiene la lógica de detección de matches (new/updatable/ambiguous) pero **no está cableado a la UI ni al ejecutor final**. Sin esto, el flujo de upsert no se puede activar.

### 1 · Checkbox "Actualizar asistentes existentes" en preview
**`ImportCsvModal.tsx`**
- Agregar `Checkbox` visible en el paso de preview cuando se detecten matches (`updatableCount > 0 || ambiguousCount > 0`).
- Estado local `updateExisting: boolean` controla si se hace upsert o sólo insert (comportamiento actual).

### 2 · Resumen del preview con conteos
**`ImportCsvModal.tsx`**
- Mostrar bajo el preview: `X nuevos · Y actualizables · Z requieren resolución`.
- Badge ámbar para filas ambiguas, badge azul para actualizables, badge verde para nuevas.

### 3 · Botón "Resolver duplicados" + integración del modal
**`ImportCsvModal.tsx`**
- Si `ambiguousCount > 0` y `updateExisting = true` → mostrar botón "Resolver duplicados (Z)".
- Abre `ResolveAmbiguousImportModal` ya existente.
- Guardar el mapa de `resolutions` retornado en estado local.
- Botón "Confirmar importación" deshabilitado mientras `ambiguousCount > 0` y no haya resolución completa.

### 4 · Ejecutor final: rama insert vs upsert
**`ImportCsvModal.tsx` (`runImport` / handler de confirmación)**
- Si `updateExisting = false` → mantiene `bulkCreateAttendees` actual (filas duplicadas se saltan o fallan según validación previa).
- Si `updateExisting = true` → llama a `bulkUpsertAttendees(eventId, rows, resolutions)`.
- Toast de resumen final: `"X creados · Y actualizados · Z saltados · W errores"`.
- Mostrar `ImportErrorsModal` si hay errores devueltos.

### 5 · Ajustes menores
- Verificar que las claves i18n usadas en el modal (`attendees.importModal.resolve.*`) existan; agregar las que falten.
- Asegurar invalidación de queries (`['admin-attendees', eventId]`) tras upsert exitoso.

## Verificación end-to-end (post-implementación)

1. Activar toggle "Códigos del congreso" en `/admin/event-config`.
2. Subir CSV con 3 escenarios: 1 email nuevo, 1 email único existente, 1 email duplicado en BD.
3. Preview muestra: `1 nuevo · 1 actualizable · 1 requiere resolución`.
4. Marcar checkbox "Actualizar existentes" → aparece botón "Resolver duplicados".
5. Abrir modal → elegir candidato para el email duplicado.
6. Confirmar import → toast `"1 creado · 2 actualizados"`.
7. Validar en BD: `external_credential_code` poblado en los 2 actualizados, sin tocar `credential_code` ni `access_code_hash`.
8. Login como uno de ellos → "Mi Perfil" muestra "Código del congreso".

