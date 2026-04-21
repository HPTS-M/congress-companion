

## Ajuste de tamaño de las tarjetas de patrocinadores

Mirando tu captura, el problema es claro: **el botón "Me interesa" se sale del lado derecho** de la tarjeta. Sucede porque en móvil la columna de info (centro) tiene `flex-1` y el botón ocupa su ancho natural, lo que en pantallas de ~360px hace que el botón se desborde junto al chevron.

### Diagnóstico preciso

Layout móvil actual de la card:
```
[Logo 56×56] [ Info flex-1 ............ ] [ Chevron ]
                Nombre
                📍 Stand
                [chip categoría]
                                  [♡ Me interesa]  ← se sale
```

Causas:
- Logo `h-14 w-14` (56px) + gaps + padding del card consumen ~80-90px del ancho útil.
- El bloque de info usa `flex-1` pero su contenido interno (nombre + botón) no respeta el ancho del contenedor — el botón "Me interesa" tiene texto largo y termina empujando el layout.
- En el screenshot se ve el corte en "Me interes**a**" a la derecha de las 3 tarjetas.

### Cambios propuestos (todos en `src/pages/attendee/Commercial.tsx`)

**1. Reducir tamaño general de la card en móvil**
- Padding del card: `p-3` → `p-2.5` (libera 4px laterales).
- Logo móvil: `h-14 w-14` → `h-12 w-12` (48px, libera 8px).
- Gap entre logo e info: `gap-3` → `gap-2.5`.

**2. Hacer el botón "Me interesa" más compacto**
- Tamaño de botón: `text-xs h-8` → `text-[11px] h-7` con `px-2.5`.
- Acortar texto cuando el espacio es tight: usar `lead.interestedShort` ("Interesa" / "Interested") en móvil, mantener "Me interesa" / "I'm interested" en desktop.
- Truncar con `max-w-full` y `whitespace-nowrap` para garantizar que respete el contenedor.

**3. Garantizar contención del overflow**
- Card: agregar `overflow-hidden` al contenedor principal.
- Bloque de info: cambiar `flex-1 min-w-0` → asegurar que `min-w-0` esté presente para que `truncate` funcione en el nombre.
- Nombre: agregar `truncate` (single line con `…`) en móvil cuando excede, mantener `line-clamp-2` solo en desktop.
- El contenedor del botón: `flex justify-end w-full` para que el botón nunca exceda el ancho del bloque de info.

**4. Ajustar chevron**
- Reducir tamaño: `h-4 w-4` → `h-3.5 w-3.5` y darle `shrink-0` (ya lo tiene).
- Mantener visible solo en móvil (ya está con `sm:hidden`).

### Mockup resultante (móvil 360px)

```
┌──────────────────────────────────────────┐
│ [LOGO]  CLAUDIA PRUEBA              ›   │
│  48×48  📍 Stand 2                       │
│         [Farmacéutica]                   │
│                          [♡ Interesa]    │  ← cabe completo
└──────────────────────────────────────────┘
```

En desktop/tablet (≥640px) **no cambia nada visible** — el grid de 2 columnas con card vertical sigue idéntico, ya que tiene espacio sobrado.

### Archivos afectados

```text
EDIT  src/pages/attendee/Commercial.tsx     — paddings, tamaños y truncado del card móvil
EDIT  src/locales/es/commercial.json        — agregar key lead.interestedShort = "Interesa"
EDIT  src/locales/en/commercial.json        — agregar key lead.interestedShort = "Interested"
EDIT  src/components/attendee/SponsorLeadButton.tsx — usar variante corta cuando se pase prop `compact`
```

Sin migraciones, sin nuevas dependencias, sin cambios de lógica, sin cambios en navegación.

### Verificación

1. Abrir `/commercial` en móvil 360×800 → el botón "♡ Interesa" cabe completo dentro del card, sin corte.
2. El chevron `›` queda alineado a la derecha del nombre, visible.
3. Tap en cualquier parte del card → abre detalle.
4. Tap en "Interesa" → abre dialog de consentimiento sin abrir detalle.
5. Después de marcar interés → cambia a "♥ Enviado" (también compacto).
6. En tablet 820px → vuelve al grid de 2 columnas con texto completo "Me interesa".
7. Modo oscuro → contraste y bordes legibles, sin overflow.

