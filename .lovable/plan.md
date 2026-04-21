

## Plan — Quitar tilde de "CONGRÉSSAPP" → "CONGRESSAPP"

### Alcance
Reemplazar todas las ocurrencias de `CONGRÉSSAPP` (con tilde en la E) por `CONGRESSAPP` (sin tilde) en todo el código fuente y configuración.

### Archivos a modificar (59 ocurrencias en 8 archivos)

| Archivo | Líneas | Tipo de cambio |
|---------|--------|----------------|
| `vite.config.ts` | 30-31 | Nombre PWA y short_name |
| `docs/PRODUCT_OWNER_USER_STORIES.md` | 1, 897-898 | Título y footer del documento |
| `tailwind.config.ts` | 68 | Comentario de tokens |
| `src/index.css` | 8, 47 | Comentario de Design System y Status Colors |
| `src/main.tsx` | 16 | Console.log de build marker |
| `src/components/ErrorFallback.tsx` | 166 | Atributo alt de imagen |
| `public/sw.js` | 1, 14 | Comentario y título por defecto de notificaciones push |
| `supabase/functions/_shared/email-templates.ts` | 2, 23, 160-161 | Email templates (appName y comentarios) |

### Cambio específico
```typescript
// ANTES:
const BRAND = {
  appName: 'CONGRÉSSAPP',
  ...
};

// DESPUÉS:
const BRAND = {
  appName: 'CONGRESSAPP',
  ...
};
```

### Impacto
- **PWA**: El nombre mostrado en "Agregar a pantalla de inicio" cambia.
- **Emails**: El footer de los correos transaccionales ahora dice "© 2026 CONGRESSAPP".
- **Notificaciones push**: Título por defecto cambia.
- **Documentación**: Consistencia con la marca deseada.

### Sin cambios en
- Base de datos / RLS.
- Funcionalidad de la app.
- Lógica de negocio.

### Esfuerzo estimado
~10 minutos: búsqueda y reemplazo simple en 8 archivos.

