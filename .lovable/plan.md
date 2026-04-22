

## Plan — Eliminar validación del Código del Congreso e importar tal cual viene

### Qué quieres

Que el sistema **deje de validar** el campo `Código del congreso` (`external_credential_code`) y simplemente **lo guarde como venga** en el Excel — sin regex, sin longitud mínima/máxima, sin rechazos por caracteres especiales.

### Cambio único

**Archivo: `src/lib/import-validators.ts`**

1. **Quitar la validación de `external_credential_code`** en la función `validateRow`:
   - Eliminar la verificación contra `EXTERNAL_CODE_REGEX`.
   - Eliminar el chequeo de longitud (3-50).
   - Eliminar el error "Código de credencial externa inválido".

2. **Mantener la normalización mínima** en `normalizeRow`:
   - Casteo de número → string (para que `10851` no llegue como `10851.0`).
   - Trim de espacios y caracteres invisibles.
   - **Sin validación posterior** — lo que sea queda.

3. **Mantener `EXTERNAL_CODE_REGEX` exportado** (otros lugares pueden usarlo), pero **no aplicarlo** durante el import.

### Lo que NO cambia

- Validación de `email` (sigue estricta — sin email no se puede enviar credenciales).
- Validación de `full_name` (sigue tolerante con tildes/ñ).
- Validación de `specialty` / `institution` (sigue tolerante).
- Lógica bloqueante / permisivo / warnings.
- Detección de duplicados por código externo (sigue funcionando — usa el valor tal cual).
- Servicio de upsert, modal, mapping de estados.

### Tests a actualizar

**Archivo: `src/lib/import-validators.test.ts`**

- Eliminar/actualizar los tests que esperaban rechazo del código externo (caracteres especiales, longitud).
- Agregar tests que confirman:
  - `"CMP 12345"` (con espacio) → válido.
  - `"NIT-900.123.456"` (con puntos) → válido.
  - `"12"` (corto) → válido.
  - `""` (vacío) → válido (campo opcional).
  - `"código-ñ-001"` (con ñ y tilde) → válido.

### Riesgo aceptado

- **Duplicados silenciosos posibles**: `"CMP-12345"` y `"cmp 12345"` ahora son tratados como diferentes por el sistema. Si tu organización ya garantiza que los códigos vienen consistentes desde el sistema externo, no es problema.
- **No hay normalización agresiva** (no se quita espacios internos, ni se uniforma mayúsculas). Lo que llega es lo que se guarda.

### Resultado esperado

Recargas el Excel de 814 filas → todas las filas que solo fallaban por el código externo ahora pasan → solo quedan bloqueadas las que tienen problemas reales (email malformado, nombre vacío).

### Archivos modificados

- `src/lib/import-validators.ts` — remover bloque de validación de `external_credential_code`.
- `src/lib/import-validators.test.ts` — ajustar tests al nuevo comportamiento permisivo.

### Verificación post-cambio

1. Corro `npm test` para asegurar que los tests pasan con la nueva lógica.
2. Tú recargas el Excel → me dices cuántas filas quedaron bloqueadas (deberían ser muy pocas o ninguna).
3. Confirmamos en la base que los códigos `10851`, `10850`, etc. se guardaron correctamente.

