

## Plan: Corregir etiquetas CSV → Excel y verificar sincronización

### Problema identificado
El código del modal de importación ya usa ExcelJS correctamente, pero:
1. Las etiquetas i18n siguen diciendo "Importar CSV" / "Exportar CSV" — deben decir "Importar Excel" / "Exportar Excel"
2. La función de exportar en `Attendees.tsx` aún genera un archivo CSV manualmente en vez de usar `writeExcelFile`
3. La sección "Configuración" ya está en el código del sidebar pero no aparece visible — probablemente un problema de caché/sincronización del preview

### Cambios

1. **`src/locales/es/admin.json`** — Cambiar `importCsv` → "Importar Excel", `exportCsv` → "Exportar Excel"
2. **`src/locales/en/admin.json`** — Cambiar `importCsv` → "Import Excel", `exportCsv` → "Export Excel"  
3. **`src/pages/admin/Attendees.tsx`** — Reemplazar la función `handleExportCsv` que genera CSV manual por una que use `writeExcelFile` de `@/lib/excel` para generar `.xlsx`
4. **Forzar recompilación** — Tocar los archivos clave para asegurar que Vite refresque el preview

### Resultado esperado
- Los botones dirán "Importar Excel" y "Exportar Excel"
- La exportación generará un archivo `.xlsx` profesional
- El sidebar debería mostrar "Configuración" tras la recompilación

