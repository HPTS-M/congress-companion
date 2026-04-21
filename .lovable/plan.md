

# Plan: Filtros mobile estilo Agenda en Comercial + Admin Providers

Aplicar el patrón de **chips horizontales scrollables** (modelo Agenda) en ambas páginas, con regla clara para escalar a dropdown si crecen las categorías.

---

## Decisión de diseño

**Regla de escalado por cantidad de filtros:**

| Cantidad de chips | Patrón recomendado |
|---|---|
| 2–8 chips | **Chips horizontales** (scroll suave + fade right) ✅ Caso actual |
| 9–15 chips | Chips + botón "Más filtros" → bottom sheet con multi-select |
| 16+ chips | **Dropdown / bottom sheet** con buscador interno |

**Razón:** Con ≤8 categorías, el costo cognitivo de abrir un dropdown (2 taps + lectura de lista) supera al simple swipe horizontal (1 gesto, todo visible). Con 16+ chips, el swipe se vuelve tedioso y el dropdown gana.

**Caso actual:**
- **Comercial (attendee):** 6 categorías → chips ✅
- **Admin Providers:** 4 tipos (transport, food, tour, special) → chips ✅

Ambos casos están en el rango óptimo para chips. Si en el futuro Comercial pasa de 8 categorías → migrar a bottom sheet. Lo dejamos documentado en código como TODO con la regla.

---

## Cambios — Página Comercial (attendee)

`src/pages/attendee/Commercial.tsx` ya tiene la estructura correcta (chips horizontales en `flex gap-2 overflow-x-auto`). Mejoras necesarias:

1. **Fade indicator a la derecha** cuando hay más chips fuera de viewport (gradiente blanco → transparente, 24px ancho)
2. **Scroll snap** para alinear chips al hacer swipe (`snap-x snap-mandatory` en contenedor, `snap-start` en cada chip)
3. **Padding inferior** del scroll container (`pb-2 -mb-2`) para que el fondo activo del chip no se corte
4. **Auto-scroll al chip activo** cuando se selecciona uno fuera de viewport (`scrollIntoView({ inline: 'center', behavior: 'smooth' })`)
5. **Touch momentum** en iOS (`-webkit-overflow-scrolling: touch` ya cubierto por `overflow-x-auto`)

---

## Cambios — Admin Providers

`src/pages/admin/Providers.tsx` actualmente solo tiene buscador, sin filtros por tipo. Añadir:

1. **Fila de chips** debajo del buscador con los 4 tipos (`transport`, `food`, `tour`, `special`) + chip "Todos (N)"
2. Cada chip muestra ícono del tipo (de `TYPE_ICONS`) + label traducido + contador
3. Mismo patrón visual que Comercial (scrollable, fade, snap)
4. Filtro adicional: chip "Solo activos" (toggle separado a la derecha) para filtrar `is_active = true`
5. Estado controlado: `selectedTypes: string[]` y `onlyActive: boolean`
6. Filtrado client-side sobre el array ya cargado (`providers.filter(...)`)

---

## Componente compartido nuevo

Crear **`src/components/ui/filter-chips.tsx`** reutilizable:

```ts
interface FilterChipsProps {
  options: Array<{ value: string; label: string; icon?: LucideIcon; count?: number }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  allLabel?: string;          // chip "Todos"
  allCount?: number;
  multiSelect?: boolean;      // default true
  className?: string;
}
```

Encapsula: scroll horizontal, fade derecha, snap, auto-scroll al activo, accesibilidad (`role="radiogroup"` o `"group"`, navegación por teclado con flechas).

Usar este componente en:
- `Commercial.tsx` (categorías)
- `Providers.tsx` (tipos)
- Disponible para futuras páginas (Documents, Tickets, Sponsors admin)

---

## i18n

Añadir en `src/locales/{es,en}/admin.json`:
- `providers.filters.allTypes` → "Todos los tipos" / "All types"
- `providers.filters.onlyActive` → "Solo activos" / "Active only"

(Los nombres de tipo ya existen en `provider:type.transport/food/tour/special` o equivalente; verificar y reutilizar.)

---

## Accesibilidad

- Chips son `<button>` con `aria-pressed={active}`
- Contenedor con `role="group"` y `aria-label="Filtros"`
- Foco visible (`focus-visible:ring-2 ring-primary`)
- Navegación por teclado: Tab entre chips, Enter/Space para activar
- Fade derecho oculto a screen readers (`aria-hidden`)

---

## Plan de prueba

1. **Comercial mobile (375px):** ver fade derecho, swipe natural, snap al soltar
2. **Seleccionar chip oculto** (ej. "Otros") → auto-scroll lo trae a vista
3. **Comercial desktop:** comportamiento idéntico, sin scroll si caben todos
4. **Admin Providers:** chips funcionan, contadores correctos, "Solo activos" filtra bien
5. **Multi-select:** elegir 2 categorías → ambas con check, lista filtrada por OR
6. **Teclado:** Tab + Enter activa chips correctamente
7. **Dark mode:** fade adapta color de fondo

---

## Archivos afectados

```
NEW   src/components/ui/filter-chips.tsx
EDIT  src/pages/attendee/Commercial.tsx           (usar FilterChips)
EDIT  src/pages/admin/Providers.tsx               (añadir FilterChips + onlyActive)
EDIT  src/locales/es/admin.json                   (2 keys)
EDIT  src/locales/en/admin.json                   (2 keys)
```

**Total: 1 nuevo + 4 editados.** ~30 minutos.

---

## Lo que NO incluye

- Bottom sheet de filtros (se justificará cuando alguna página supere 8 chips)
- Filtros guardados/persistidos en URL (iteración futura si se pide)
- Cambios en filtros existentes de `AttendeesFilters` (ya tiene su propio patrón con multi-select de specialty/institution que SÍ necesita dropdown por volumen — ese caso queda como referencia de cuándo usar dropdown)

