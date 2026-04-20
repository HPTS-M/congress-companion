

## Por qué `quimicofarmaceutico@clinicacentral.com` aparece como "Formato inválido"

### Diagnóstico

El email **es válido** según la regex (`/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`). El problema NO es el email, es **cómo viene la celda en el Excel**.

En la captura se ve claramente: la celda email muestra `[object Object]` en vez del email. Eso significa que ExcelJS está leyendo esa celda como un **objeto hyperlink** (`{ text: "...", hyperlink: "mailto:..." }`), no como un string plano. Pasa cuando el Excel original tiene el email formateado como enlace clickeable (Excel auto-convierte `correo@dominio.com` en hyperlink).

### Flujo exacto del bug

En `src/lib/excel.ts` líneas 50-62, el parser maneja:
- ✅ `richText` (texto con formato)
- ✅ `Date` (fechas)
- ❌ **NO maneja hyperlinks** → cae a `obj[header] = value` con el objeto crudo

Luego en `import-validators.ts` línea 60 hace `String(v).trim()` sobre el objeto → produce literalmente `"[object Object]"` → falla la regex de email → **"Formato inválido"**.

Mismo problema afecta a la fila 30 "SOFIA TORRES VALENCIA": su columna también muestra `[object Object]`.

### Fix propuesto (1 archivo, ~6 líneas)

**`src/lib/excel.ts`** — agregar manejo de hyperlinks y formula objects en el parser, justo antes de la línea 61:

```typescript
// Handle hyperlink cells (Excel auto-converts emails/URLs)
if (value && typeof value === 'object' && 'hyperlink' in value) {
  value = (value as { text?: string; hyperlink: string }).text 
       ?? (value as { hyperlink: string }).hyperlink.replace(/^mailto:/i, '');
}
// Handle formula cells (e.g. computed emails)
if (value && typeof value === 'object' && 'result' in value) {
  value = (value as { result: unknown }).result;
}
// Handle shared strings / other object shapes — fallback
if (value && typeof value === 'object' && !(value instanceof Date)) {
  value = String((value as { text?: unknown }).text ?? '');
}
```

### Garantías post-fix

- Emails formateados como hyperlink en Excel se leerán como string limpio.
- Funciona para **todos los módulos de import** (asistentes, sponsors, polls, agenda) porque todos usan `parseExcelFile`.
- El fix es defensivo: si aparecen otros tipos de objeto raros, devuelve string vacío en vez de `[object Object]`.
- Tras aplicarlo, el admin solo necesita re-subir el mismo archivo — no hay que limpiar el Excel manualmente.

### Recomendación adicional (opcional)

Agregar test unitario en `src/lib/excel.test.ts` (no existe aún) que cargue un buffer con celdas hyperlink para evitar regresiones.

### Archivos tocados
1. `src/lib/excel.ts` — manejo de hyperlinks + formulas + fallback de objeto.

