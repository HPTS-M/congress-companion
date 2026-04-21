

# Plan: Tarjetas de Sponsor estilo Agenda

## Mi opinión honesta primero

**Replicar 1:1 el diseño de Agenda en Comercial es buena idea, pero con un matiz importante.**

✅ **Lo que SÍ vale la pena copiar:**
- Tamaño de tarjeta (full-width, padding generoso `p-4 pl-5`)
- Layout vertical con info apilada (no horizontal compacto como ahora)
- **Border-left de 4px coloreado por nivel** (gold/silver/bronze/exhibitor) — equivale al border-left por tipo de sesión
- Tipografía: título `text-base font-semibold`, metadatos `text-xs text-muted-foreground` con íconos pequeños
- Botón de acción abajo a la derecha con `Button size="sm"`
- Espaciado interno (`space-y-1.5` entre líneas de metadata)

⚠️ **Lo que NO conviene copiar literal:**
- El **círculo de "Pendiente/Confirmado"** a la derecha — los sponsors no tienen estado de check-in. En su lugar usaremos ese espacio para el **logo del sponsor** (que es la identidad visual más importante de un sponsor — más que el nombre).
- El **contador de estrellas ⭐** — los sponsors no tienen "interesados públicos". Lo reemplazamos por el **chevron "›"** indicando que es navegable al detalle.

🎯 **Resultado final:** Misma silueta visual y "peso" que Agenda (consistencia entre módulos), pero adaptada a la semántica de un sponsor (logo prominente + nivel + categoría + stand + CTA).

Esto resuelve dos problemas actuales que veo en tu screenshot:
1. Las tarjetas actuales se sienten "apretadas" comparadas con Agenda → ahora respiran igual
2. La inconsistencia visual entre Comercial y Agenda → ahora son visualmente hermanas

---

## Cambios concretos

### `SponsorCard` (en `Commercial.tsx`)

**Estructura nueva — espejo de `SessionCard`:**

```
┌─────────────────────────────────────────────┐
│ 🟨 [LOGO]  Laboratorios ABC            ›    │  ← border-left 4px color nivel
│  60×60     📍 Stand A-15                    │
│           👤 Farmacéutica                   │
│           [Badge: ORO] [Badge: Stand]       │
│                                             │
│                          [♥ Me interesa]   │  ← botón abajo derecha
└─────────────────────────────────────────────┘
```

**Spec exacta:**
- Container: `rounded-lg border-t border-r border-b border-border bg-card shadow-sm p-4 pl-5` + `borderLeft: 4px solid {LEVEL_COLOR}`
- Mapeo de colores border-left por nivel:
  - `gold` → `#F59E0B`
  - `silver` → `#94A3B8`
  - `bronze` → `#B45309`
  - `exhibitor` → `#1A56A0`
- Layout: `flex items-start justify-between gap-2`
- **Izquierda (logo)**: `h-14 w-14 sm:h-16 sm:w-16 rounded object-contain bg-white shrink-0` (o avatar con iniciales si no hay logo)
- **Centro (info)**: `flex-1 min-w-0 space-y-1.5`
  - Título: `text-base font-semibold text-card-foreground leading-tight` + chevron derecho
  - Stand: `flex items-center gap-1.5 text-xs text-muted-foreground` con `MapPin h-3.5 w-3.5`
  - Categoría: misma fila pattern con `Building2 h-3.5 w-3.5`
  - Badges en `flex flex-wrap gap-1.5 pt-1`: Badge nivel (con ícono Crown/Award/Medal) + Badge "Stand X" si aplica
- **Botón "Me interesa"**: `mt-3 flex justify-end` con `Button size="sm" variant="default"` — mismo color que Agenda (`bg-amber-500` cuando ya está marcado como interés)

### Grid responsivo

**Eliminar `sm:grid sm:grid-cols-2`** — Agenda usa una columna en todos los tamaños y se ve excelente. Sponsors igual: `flex flex-col gap-3` sin breakpoint a 2 columnas.

Ventaja: en desktop/tablet las tarjetas ocupan todo el ancho como en Agenda → consistencia total.

### Componente extraído

Mover `SponsorCard` a archivo propio `src/components/attendee/SponsorCard.tsx` (espejo de `SessionCard.tsx`). `Commercial.tsx` queda más limpio y el componente reutilizable.

---

## Archivos afectados

```
NEW   src/components/attendee/SponsorCard.tsx   (extraído + rediseñado estilo Agenda)
EDIT  src/pages/attendee/Commercial.tsx         (importa nuevo SponsorCard, elimina grid 2-col)
```

**2 archivos. ~15 minutos.**

---

## Plan de prueba

1. Mobile 375px: tarjeta sponsor tiene exactamente el mismo "peso" visual que session card en Agenda
2. Border-left dorado se ve en sponsors gold, gris en silver, naranja en bronze
3. Logo se muestra cuadrado a la izquierda (60px), iniciales si no hay logo
4. Tap en tarjeta navega a detalle; tap en "Me interesa" no propaga
5. Desktop: tarjetas full-width (no más grid 2-col), idéntico a Agenda
6. Dark mode: colores y borders adaptan correctamente

---

## Lo que NO incluye

- Cambios en la página de detalle del sponsor (`SponsorDetail.tsx`) — mantenemos como está
- Cambios en filtros chips o búsqueda — quedaron perfectos en la iteración anterior
- Cambios en el badge del nivel (sigue usando los íconos Crown/Award/Medal actuales)

