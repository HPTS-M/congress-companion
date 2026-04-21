

## Ajuste armónico del SponsorCard — sin scroll lateral, todo dentro del ancho disponible

### Restricción dura
**El card NUNCA puede causar scroll horizontal.** Todo el contenido (logo + nombre + chevron + stand + badge + botón) debe caber dentro del ancho real disponible en el viewport más pequeño soportado: **360px**.

### Cálculo del ancho real disponible (360px viewport)

```text
Viewport:                              360px
- Padding lateral página (px-4):       -32px (16+16)
- Borde card (border 1px):              -2px
= Ancho exterior card:                 326px

- Padding interno card (p-2):          -16px (8+8)
= Ancho útil interno:                  310px

- Logo (h-10 w-10):                    -40px
- Gap logo↔info (gap-2):                -8px
= Ancho columna info:                  262px  ← aquí cabe TODO el contenido del lado derecho
```

Con 262px de columna info, todo cabe holgado:
- Nombre + chevron: ocupan el ancho completo, truncate si es largo.
- "Stand A1": ~70px.
- Badge categoría: ~110px.
- Botón "♥ Me interesa": ~95px → con `max-w-full` jamás desborda.

### Cambios definitivos (armónicos y conservadores)

**1. `src/pages/attendee/Commercial.tsx` — `SponsorCard`**
- Padding card móvil: `p-2.5` → `p-2` (gana 4px laterales)
- Gap logo↔info: `gap-2.5` → `gap-2` (gana 2px)
- Logo móvil: `h-12 w-12` → `h-10 w-10` (gana 8px de ancho útil)
- Contenedor del botón: cambiar `flex justify-end` → `flex justify-start` solo en móvil (mantiene `sm:justify-center` desktop)
- Quitar `mt-1`, dejar `mt-0.5` para acercar verticalmente sin amontonar
- Asegurar `max-w-full` en el wrapper del botón para que el navegador siempre lo recorte antes de generar overflow
- Mantener `min-w-0` en la columna info (ya está) para que `truncate` funcione

**2. `src/components/attendee/SponsorLeadButton.tsx`**
Solo cuando `compact={true}`:
- Padding interno: `px-3` (default `size="sm"`) → `px-2.5`
- Gap icono↔texto: override del `gap-2` por defecto → `gap-1`
- Añadir `max-w-full` para que nunca desborde su contenedor
- Mantener `whitespace-nowrap` en el span del texto (no queremos partir "Me interesa")
- Mantener `size="sm"` y los textos actuales sin cambiar palabras

**Sin cambios:**
- Ningún texto en español ni en inglés (mantienes "Me interesa" / "Enviado").
- Layout tablet/desktop ≥640px (grid 2 cols, botón centrado full-width) intacto.
- Chevron, badge categoría, ubicación stand, tipografía, colores.

### Layout resultante en móvil 360px

```text
┌──────────────────────────────────────┐  ← 326px de ancho
│ ┌──┐ Nombre Sponsor              ›   │  ← logo 40px + info 262px
│ │LG│ 📍 Stand A1                     │
│ └──┘ [Farmacéutica]                  │  ← badge cabe completo
│      [♥ Me interesa]                 │  ← alineado izq, ~95px de ancho
└──────────────────────────────────────┘
   16px                        16px   ← padding página, sin overflow
```

### Garantía anti-scroll
- `min-w-0` en columna info → permite truncate del nombre.
- `truncate` en el `<h3>` del nombre → cortado con elipsis si es muy largo.
- `max-w-full` en wrapper del botón y en el botón → jamás se sale.
- `truncate` en el badge categoría (ya está) → si la traducción es larga, se corta.
- El span del botón con `whitespace-nowrap` solo afecta al texto interno; el botón completo sigue limitado por `max-w-full`.

### Archivos editados (2)

```text
EDIT  src/pages/attendee/Commercial.tsx
        SponsorCard:
        - p-2.5 → p-2
        - gap-2.5 → gap-2
        - h-12 w-12 → h-10 w-10 (logo móvil)
        - justify-end → justify-start (móvil), mantener sm:justify-center
        - mt-1 → mt-0.5
        - añadir max-w-full al wrapper del botón

EDIT  src/components/attendee/SponsorLeadButton.tsx
        Variante compact={true}:
        - px-2.5 (override del padding default sm)
        - gap-1 (override del gap-2 default)
        - max-w-full
```

### ¿Está todo correcto?

Sí. El plan respeta:
- ✅ Mobile-first 360px (LL-001 / sección 12 de las guidelines).
- ✅ Sin scroll lateral garantizado por cálculo + `max-w-full` + `truncate`.
- ✅ Sin cambios de copy ni de i18n keys.
- ✅ Sin tocar layout desktop/tablet.
- ✅ Sin tocar lógica de negocio (consent, leads, navegación).
- ✅ Cambios mínimos, armónicos, en solo 2 archivos.

### Verificación end-to-end
1. Móvil 360×800 light: card sin overflow, botón "♥ Me interesa" alineado a la izquierda con margen visible al borde derecho del card.
2. Móvil 360×800 dark: contraste correcto, sin overflow.
3. Móvil 320×568 (iPhone SE): cabe igual gracias a `truncate` + `max-w-full`.
4. Tablet 820px: layout grid 2 cols con botón centrado full-width, idéntico a hoy.
5. Estado "Enviado" tras marcar interés: cabe igual en la nueva posición.
6. Sponsor con nombre muy largo ("Laboratorios Farmacéuticos Internacionales SA"): se trunca con elipsis, no rompe layout.
7. Comprobar `document.body.scrollWidth === window.innerWidth` en DevTools → sin scroll horizontal.
8. Tap en card abre detalle; tap en botón abre dialog sin abrir detalle.

