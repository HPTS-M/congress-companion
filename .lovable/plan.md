

## Plan: Desactivar Service Worker en Preview y limpiar Cache Storage

### Problema
El `vite-plugin-pwa` con `registerType: "autoUpdate"` auto-registra el Service Worker en producción. La limpieza actual en `main.tsx` desregistra workers pero NO borra el Cache Storage, y además la detección de preview incluye `.lovable.app` que es también el dominio publicado.

### Cambios

**1. `vite.config.ts`** — Cambiar a registro manual
- Agregar `injectRegister: false` al config de VitePWA para que NO auto-registre el SW.
- Esto da control total desde `main.tsx`.

**2. `src/main.tsx`** — Reescribir la lógica de SW con 3 mejoras:

a) **Corregir detección de preview**: Solo considerar preview si el hostname contiene `id-preview--` O si está en iframe. Quitar `lovable.app` de la lista (es el dominio publicado).

b) **Purgar Cache Storage completo en preview**: Además de desregistrar workers, borrar todas las entradas de `caches` con `caches.keys()` + `caches.delete()`.

c) **Registrar SW solo en producción real**: Si NO es preview/iframe, registrar manualmente el SW generado por Workbox (`/sw.js`).

d) **Agregar marca de build**: Un `console.log` con timestamp de build para verificar qué versión corre el navegador.

### Código resultante en main.tsx (esquema)

```typescript
// Detección de preview (sin .lovable.app)
const isPreviewHost = hostname.includes('id-preview--') || hostname.includes('lovableproject.com');
const isInIframe = window.self !== window.top;
const isPreview = isPreviewHost || isInIframe;

if (isPreview) {
  // Desregistrar todos los SW
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  // Purgar TODO el Cache Storage
  caches.keys().then(names => names.forEach(name => caches.delete(name)));
} else {
  // Registrar SW solo en producción
  navigator.serviceWorker?.register('/sw.js');
}

console.log('[CONGRÉSSAPP] Build:', __BUILD_TIME__);
```

### Archivos a modificar
- `vite.config.ts` (1 línea: `injectRegister: false`)
- `src/main.tsx` (reescribir bloque de SW ~15 líneas)

### Resultado esperado
- En Preview: cero service workers, cero caches heredadas. Cambios se ven inmediatamente.
- En Publicado: PWA funciona normal con offline y cache.
- El `console.log` de build permite verificar qué versión está activa.

