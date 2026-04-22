

## Plan — Hacer el validador tolerante para que acepte tus 814 registros sin tocar el Excel

### Diagnóstico

Tu Excel está bien — el validador es demasiado estricto. Mirando tu muestra de 9 filas, hay 3 patrones reales que rompen la validación actual:

1. **Tildes en MAYÚSCULA** (`QUÍMICO FARMACÉUTICO`, `LÓPEZ FLORIAN`)
   - El regex `NAME_REGEX` y `TEXT_NO_SPECIAL_REGEX` técnicamente incluye `ÁÉÍÓÚ`, pero falta `ÀÈÌÒÙ` (tildes graves) y la `Ç` (vista en algunos apellidos).

2. **Espacios no estándar / caracteres invisibles** (Excel a veces inserta `\u00A0` non-breaking space al copiar/pegar desde web/Word).
   - El `trim()` actual NO los elimina → el regex falla.

3. **Truncamiento institucional** (`CLIN. GENERAL DEL NORTE CORDIALIDAD`, `H. SOC DE ONCOLOGIA Y HEMATOLOGIA D`)
   - Estos pasan el regex actual (letras, puntos, espacios), pero si hay un `&`, `'` curva, guion largo `–` o paréntesis con caracteres especiales en otras filas → falla.

### Cambios al validador

**Archivo único: `src/lib/import-validators.ts`**

1. **Expandir `NAME_REGEX`** para aceptar todas las tildes (agudas, graves, diéresis), Ç, y espacios Unicode:
   ```
   /^[A-Za-zÀ-ÿÑñ\s.''\-]+$/
   ```
   El rango `À-ÿ` cubre todas las letras latinas acentuadas usadas en español, portugués, francés (suficiente para nombres de instituciones internacionales).

2. **Expandir `TEXT_NO_SPECIAL_REGEX`** (especialidad, institución) con el mismo rango + comillas tipográficas + guiones largos:
   ```
   /^[A-Za-zÀ-ÿÑñ0-9\s.,&''""–—\-()/+]+$/
   ```
   También agrego `+` porque algunas instituciones lo usan (ej. `H+`, `MED+`).

3. **Normalizar espacios Unicode en `normalizeRow`** antes de validar:
   ```typescript
   String(v)
     .replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, ' ')  // todos los espacios Unicode → espacio normal
     .replace(/\s+/g, ' ')  // colapsar espacios múltiples
     .trim();
   ```

4. **NO tocar `EXTERNAL_CODE_REGEX`** — sigue estricto (`/^[A-Za-z0-9_\-]{3,50}$/`). Tus códigos `10851`, `10850` etc. ya pasan correctamente con el fix anterior de número-como-texto.

### Tests a actualizar

**Archivo: `src/lib/import-validators.test.ts`**

Agregar casos:
- `QUÍMICO FARMACÉUTICO` → válido (tildes mayúsculas)
- `LÓPEZ FLORIAN` → válido
- `H. SOC DE ONCOLOGIA Y HEMATOLOGIA D` → válido
- Nombre con `\u00A0` (non-breaking space) → válido tras normalización
- `CLIN. DEL ROSARIO TESORO` → válido
- Código `10851` numérico → válido

### Lo que NO cambia

- Validación de email (sigue estricta).
- Validación de código de credencial externa (sigue estricta — es identificador único).
- Lógica bloqueante/permisivo/warning.
- Mapping de estados (1/2/3).
- Servicio de import, modal, deduplicación, upsert.

### Resultado esperado

Después del cambio, recargas tu mismo Excel de 814 filas:
- Las filas con tildes, instituciones largas, caracteres invisibles → **válidas**.
- Solo quedarán bloqueadas filas con problemas reales (email malformado, código externo inválido, nombre vacío).
- Si aún quedan rechazos, te muestro exactamente cuántos y por qué carácter — pero deberían ser muy pocos comparado con 814.

### Archivos modificados

- `src/lib/import-validators.ts` — regex expandidos + normalización Unicode.
- `src/lib/import-validators.test.ts` — casos nuevos para tildes mayúsculas, espacios invisibles, instituciones largas.

### Verificación

Después del fix, corro los tests con `npm test` para confirmar que los nuevos casos pasen y los antiguos no se rompan. Luego me dices si la importación de tu archivo de 814 filas pasó o cuántas quedaron bloqueadas.

