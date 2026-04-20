

## Plan: Eliminar logo duplicado en Home (mobile-first, limpio)

### Diagnóstico

El Home muestra dos veces la misma imagen porque:
- `AppHeader` renderiza `header_logo_url` (logo pequeño persistente arriba).
- `Home.tsx` renderiza `banner_url` en una tarjeta grande debajo.

Cuando el admin sube la **misma imagen** a ambos campos (caso actual del evento ACQFH-2026), el logo aparece duplicado en pantalla móvil. Además, el fallback de ambos también puede coincidir si no hay personalización.

### Solución (mobile-first, limpia, sin tocar BD ni admin)

Aplicar **render condicional** en `src/pages/attendee/Home.tsx`:

1. **Detectar duplicado** comparando `bannerUrl` vs `headerLogoUrl` (incluyendo el caso "ambos vacíos → mismo fallback").
2. **Cuando hay banner distinto** → mantener tarjeta con `<img>` actual (caso premium, banner promocional propio).
3. **Cuando hay duplicado o no hay banner propio** → reemplazar por un **encabezado tipográfico** con el nombre del evento + sede/ciudad. Mejor jerarquía, menos ruido, ahorro de ~280 px de scroll.

### Mejores prácticas mobile-first aplicadas

- **Reducir ruido visual**: eliminar redundancia mejora escaneo en 360 px.
- **Jerarquía clara**: nombre del evento como `<h1>` cuando no hay banner — el usuario sabe inmediatamente dónde está.
- **Sin layout shift**: el contenedor mantiene padding/sombra equivalentes; no salta el viewport al cargar.
- **Touch-friendly**: no se introducen elementos interactivos nuevos; los existentes (botones de mapa) conservan ≥44 px.
- **Dark mode nativo**: usar tokens (`text-foreground`, `text-muted-foreground`, `bg-card`) — sin colores hardcodeados.
- **i18n**: sin strings nuevos hardcodeados; reutilizar `event.name` y `event.venue_address`/`event.venue_name` ya disponibles. Si se necesita una etiqueta, usar clave existente.
- **Accesibilidad**: cuando se muestra `<img>`, mantener `alt` significativo; cuando se muestra encabezado tipográfico, usar `<h1>` semántico.
- **Sin nuevos paquetes** ni cambios de schema.

### Cambios

**`src/pages/attendee/Home.tsx`** (único archivo a modificar):

- Importar también `headerLogoUrl` desde `useEventSettings()`.
- Calcular `hasDistinctBanner`:
  - `true` si `bannerUrl` está definido **y** no es igual a `headerLogoUrl`.
  - `false` en cualquier otro caso (ambos vacíos, ambos iguales, solo header logo).
- Reemplazar el bloque actual de la tarjeta del logo por:
  - Si `hasDistinctBanner` → tarjeta con `<img src={bannerUrl} alt={event?.name} />` (mantiene comportamiento actual para clientes con banner promocional propio).
  - Si NO → bloque tipográfico:
    - `<h1>` con `event?.name` (24 px bold, `text-foreground`).
    - `<p>` con sede/ciudad (`venue_name` + ciudad si existen, `text-muted-foreground`, 14 px).
    - Mismo padding y `mt-6` para conservar el ritmo visual del resto de la página.
- Conservar intacta la tarjeta de "Información del Evento" debajo (fechas, dirección, asistentes).

### Sin cambios en

- `AppHeader` (sigue mostrando el logo pequeño persistente — única fuente de identidad).
- BD, RLS, edge functions, admin, configuración de branding.
- Otros módulos.
- Layout desktop (el cambio es agnóstico al breakpoint y mejora ambos).

### Verificación post-deploy

1. **Caso actual ACQFH-2026 (logos iguales)**: en móvil el Home muestra encabezado tipográfico con "ACQFH 2026" + sede; **sin** la tarjeta del logo grande. El header sigue mostrando el logo pequeño arriba.
2. **Caso con banner distinto** (admin sube imagen diferente al campo banner): el banner promocional grande aparece como antes.
3. **Móvil 360 px**: sin scroll innecesario, jerarquía limpia, sin duplicación.
4. **Dark mode**: encabezado legible con tokens semánticos.
5. **Desktop ≥768 px**: mismo comportamiento, sin regresiones.
6. **Sin caché vieja**: como ya bajamos `staleTime` a 60 s + realtime, los cambios de branding del admin se reflejan en <1 min.

