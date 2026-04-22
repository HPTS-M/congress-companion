

## Plan — Diagnóstico del rechazo del código de credencial externa al importar

### Qué está pasando (análisis del código actual)

Cuando el toggle **"Códigos de credencial externa"** está activado, el sistema valida la columna `Código del congreso` (header alias: `external_credential_code`) con esta regla estricta:

```
/^[A-Za-z0-9_\-]{3,50}$/
```

Esto significa que **solo se aceptan**:
- Letras A–Z y a–z (sin acentos, sin ñ)
- Dígitos 0–9
- Guion bajo `_`
- Guion medio `-`
- Longitud entre 3 y 50 caracteres

**Rechazos comunes** (lo más probable que te esté pasando):

| Caracter en tu plantilla | ¿Pasa? | Por qué |
|---|---|---|
| `CMP-12345` | ✅ | letras, dígitos, guion |
| `CMP_12345` | ✅ | guion bajo permitido |
| `12345` | ✅ | solo dígitos, ≥3 chars |
| `CMP 12345` | ❌ | **espacios no permitidos** |
| `CMP.12345` | ❌ | **punto no permitido** |
| `CMP/12345` | ❌ | **slash no permitido** |
| `CMP#12345` | ❌ | **caracteres especiales no permitidos** |
| `Ñ-123` | ❌ | **ñ no permitida** |
| `CC-123456` con tilde | ❌ | **tildes no permitidas** |
| `12` | ❌ | **menos de 3 caracteres** |
| celda numérica `12345` | ⚠️ | depende: si Excel guarda como número y luego se castea a string queda `"12345"` (válido), pero si tiene formato moneda/decimal puede salir `"12345.00"` (válido por longitud, pero el `.` lo rompe) |

### Lo que necesito de ti para confirmar el caso exacto

Para darte el diagnóstico preciso (espacios, punto, ñ, formato Excel, etc.), necesito que me compartas **uno de estos dos**:

**Opción A — Pega aquí 3-5 valores literales** del campo `Código del congreso` que están siendo rechazados, **exactamente como están en la celda**. Ejemplo:
```
CMP 12345
NIT-900.123.456
12
ÑÑ-001
```

**Opción B — Sube el archivo .xlsx** (o un fragmento de 5 filas con datos reales/anonimizados) a este chat. Yo lo abro con un script para inspeccionar:
- El valor crudo de cada celda
- El tipo (texto vs número)
- El formato Excel (número, moneda, texto)
- Si hay caracteres invisibles (espacios al inicio/fin, tabs, no-break spaces)

### Por qué no puedo simplemente "relajar" el regex sin tu input

El regex actual es estricto a propósito porque el `external_credential_code` se usa como identificador único de la persona en el sistema externo (RUT, cédula, NIT, código de colegiatura). Aceptar espacios o caracteres especiales rompería las búsquedas de duplicados (`CMP-12345` ≠ `CMP 12345` ≠ `cmp-12345` para el sistema, y eso multiplica el riesgo de duplicados silenciosos).

Las dos posibles soluciones reales después del diagnóstico son:

1. **Si el problema es formato de tu plantilla** → corregir las celdas y reimportar (sin tocar código).
2. **Si el formato de tu organización legítimamente incluye otros caracteres** (ej: cédulas colombianas con puntos `1.234.567`, o códigos con espacios) → ajustar el regex y la lógica de normalización para aceptar esos caracteres y/o normalizarlos antes de guardar (ej: quitar puntos automáticamente).

### Próximos pasos

1. Tú me compartes el fragmento (Opción A o B).
2. Yo te confirmo exactamente qué carácter o regla está fallando.
3. Decidimos juntos: ¿corregir la plantilla, o ampliar el regex/normalización del sistema?
4. Si decidimos ampliar el sistema, te traigo un plan corto con los cambios específicos al validador y el efecto en duplicados/búsqueda.

### Archivos involucrados (referencia técnica)

- `src/lib/import-validators.ts` — define `EXTERNAL_CODE_REGEX` y la validación.
- `src/components/admin/attendees/ImportCsvModal.tsx` — corre la validación al cargar el archivo y bloquea filas con error.
- `src/lib/import-validators.test.ts` — tests unitarios que documentan el comportamiento actual.

**Sin cambios en código todavía** — primero diagnóstico con tu fragmento.

