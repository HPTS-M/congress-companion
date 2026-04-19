
El usuario quiere cambiar la política de validación: el **email duplicado** ya no es bloqueante — pasa a ser **advertencia (warning)**. El usuario decide si carga o no. El **código credencial externo** se mantiene como **bloqueante absoluto** (nunca se puede repetir, identifica al individuo).

## Plan

### 1. `src/lib/import-validators.ts`
- Mantener `BLOCKING_FIELDS_ALWAYS = ['full_name']` (quitar `email`).
- Crear nueva categoría `WARNING_FIELDS = ['email']` para duplicados (formato sigue bloqueante).
- Actualizar `classifyRow` para devolver `{ blocked, blockingErrors, permissiveErrors, warningErrors }`.
- **Email**: formato inválido → bloqueante. Duplicado (en file o DB) → warning.
- **Código credencial externo**: formato inválido O duplicado → SIEMPRE bloqueante.

### 2. `src/components/admin/attendees/ImportCsvModal.tsx`
- Reclasificar filas con email duplicado como `warning` (no `blocked`).
- Nueva sección en el preview: contador "X advertencias" + botón "Ver advertencias".
- Si hay warnings, mostrar diálogo de confirmación antes de importar: "Hay N filas con email duplicado. Se cargarán de todos modos. ¿Continuar?".
- Generar archivo Excel `advertencias-importacion.xlsx` con las filas marcadas (mismo patrón que el de errores).
- Mantener el flujo bloqueante intacto para credencial externa.

### 3. Nuevo componente `ImportWarningsModal.tsx`
- Tabla con filas de advertencia, columna "Motivo" (email duplicado en archivo / email duplicado en BD).
- Botón "Descargar advertencias" → exporta Excel.
- Botón "Continuar e importar" → confirma y procede.
- Botón "Cancelar".

### 4. i18n (`es/admin.json` + `en/admin.json`)
- Nuevas claves: `importModal.warnings.*`, `importModal.warningsModal.*`, `importModal.duplicateEmailWarning`, `importModal.confirmWithWarnings`.

### 5. Verificación
- Tests unitarios: actualizar `import-validators.test.ts` para validar la nueva clasificación (email duplicado = warning, código duplicado = blocked).
- Test funcional: importar CSV con 2 filas mismo email → ambas se cargan tras confirmación.
- Test funcional: importar CSV con 2 filas mismo código externo → segunda fila bloqueada.

### Reglas confirmadas (tras tu mensaje)
| Campo | Duplicado en archivo | Duplicado en BD | Formato inválido |
|---|---|---|---|
| Nombre | n/a | n/a | Bloqueante |
| **Email** | **Warning** | **Warning** | Bloqueante |
| **Código externo** | **Bloqueante** | **Bloqueante** | Bloqueante |
| Especialidad / Institución | n/a | n/a | NO APLICA |
| Estado | n/a | n/a | Bloqueante |

⚠️ Nota técnica: la BD actualmente tiene índice único `(email, event_id)` en `attendees`. Hay que verificar y posiblemente eliminarlo para permitir emails duplicados (el código credencial externo SÍ debe mantener su índice único). Lo verifico al pasar a default mode.
