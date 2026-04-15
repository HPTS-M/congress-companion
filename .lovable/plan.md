

## Plan: Mover la barra de navegación de abajo hacia arriba

### Problema
El usuario quiere que la barra de navegación (Inicio, Agenda, Check-in, Tickets, Comercial, Encuestas) se mueva de la parte inferior a la parte superior, justo debajo del header. Debe ser visible en **todos los módulos**, no solo en Home.

### Solución

Convertir `BottomNav` en una barra fija superior (debajo del header) en lugar de inferior. Ajustar el layout para que el contenido tenga padding-top para ambas barras y ya no padding-bottom.

### Cambios

| Archivo | Cambio |
|---|---|
| `src/components/layout/BottomNav.tsx` | Cambiar posición de `fixed bottom-0` a `fixed top-14 md:top-16` (debajo del header). Cambiar `border-t` por `border-b`. |
| `src/components/layout/AttendeeLayout.tsx` | Ajustar padding del `<main>`: de `pt-14 pb-16` a `pt-28 pb-0` (header 56px + nav 64px = 120px ≈ pt-[7.5rem]). En desktop: `md:pt-32 md:pb-0`. |
| `src/pages/attendee/Home.tsx` | Eliminar la sección "Quick Access Icons" (líneas 55-74) ya que la barra superior cumple esa función y es redundante. También eliminar los imports y tipos no usados (`Link`, `HomeIcon`, `Ticket`, `Building2`, `BarChart3`, `quickAccessItems`, `visibleItems`). |

### Layout resultante

```text
┌─────────────────────────────────┐  ← Header fijo (56px)
│  ≡  Logo  Event Name    🌐 🔔 👤│
├─────────────────────────────────┤  ← Nav fija (64px)
│ Inicio  Agenda  Check-in  ...   │
├─────────────────────────────────┤
│                                 │
│       Contenido del módulo      │
│       (scroll normal)           │
│                                 │
└─────────────────────────────────┘
```

Tres archivos, cambios menores en cada uno.

