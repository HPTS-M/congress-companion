
## Plan — Corregir el import para que reconozca “Código del congreso” sin cambiar el Excel

### Causa raíz confirmada
El bloqueo no viene de que el dato esté vacío en tu archivo, sino de que el importador **no está leyendo esa columna**.

Hoy hay una inconsistencia interna:

- La plantilla descargable del modal exporta la columna como:
  `Código del congreso`
- Pero el validador (`src/lib/import-validators.ts`) solo reconoce aliases como:
  `Código credencial`, `Codigo credencial`, `codigo_credencial`, `credential_code`, `external_credential_code`

Como `Código del congreso` no está en `HEADER_ALIASES.external_credential_code`, el sistema la ignora, deja `external_credential_code = ''`, y luego dispara el error:
`Campo obligatorio`

Por eso te bloquea los 814 registros aunque la columna sí esté diligenciada.

### Qué voy a cambiar

#### 1) Alinear el alias del encabezado con la plantilla real
Archivo: `src/lib/import-validators.ts`

Actualizar `HEADER_ALIASES.external_credential_code` para aceptar explícitamente:

- `Código del congreso`
- `Codigo del congreso`
- `código del congreso`
- `codigo del congreso`

Y mantener los aliases anteriores por compatibilidad.

#### 2) Mantener el comportamiento actual del campo
No voy a volver a poner validación de formato sobre el valor.
El campo seguirá:
- leyéndose tal cual viene del Excel
- convirtiendo números a string cuando aplique
- exigiéndose solo si el toggle está activo

#### 3) Cubrir el caso con tests
Archivo: `src/lib/import-validators.test.ts`

Agregar pruebas para confirmar que:
- `Código del congreso` se mapea correctamente a `external_credential_code`
- un valor como `10851` se reconoce como presente
- `validateRow(..., { externalCredentialsRequired: true })` ya no marque `required` cuando el archivo usa ese encabezado

### Resultado esperado
Con tu mismo archivo actual, sin editar el Excel:

- el import dejará de marcar `Código del congreso: Campo obligatorio`
- las filas pasarán a validarse con el valor real de esa columna
- solo quedarán bloqueadas filas con problemas reales en otros campos, si existieran

### Archivos involucrados
- `src/lib/import-validators.ts`
- `src/lib/import-validators.test.ts`

### Verificación
Después del cambio, la validación debe aceptar archivos generados por la plantilla oficial del sistema y el contador ya no debería mostrar `814 bloqueado` por ese motivo.
