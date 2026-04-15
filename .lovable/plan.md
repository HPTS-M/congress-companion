

## Plan: Barra de navegación rápida visible en móvil y desktop, sin chocar con sidebar

### Problema
La barra de navegación tiene `md:hidden`, desaparece en desktop. El usuario quiere que sea visible en ambos, posicionada debajo del header y del banner del asistente, sin superponerse al sidebar.

### Solución
Quitar `md:hidden` de BottomNav y desplazarla a la derecha del sidebar en desktop usando `md:left-[var(--sidebar-width)]`. Ajustar el padding del contenido principal para compensar la barra en ambos breakpoints.

### Cambios

| Archivo | Cambio |
|---|---|
| `src/components/layout/BottomNav.tsx` | Quitar `md:hidden`. Agregar `md:left-[var(--sidebar-width)]` para que empiece después del sidebar en desktop. Mantener `left-0` en móvil. |
| `src/components/layout/AttendeeLayout.tsx` | Cambiar padding de `<main>` a `pt-[7.5rem]` en ambos (quitar `md:pt-16`), para compensar header + nav en móvil y desktop. |

### Layout resultante

```text
DESKTOP:
┌──────┬──────────────────────────┐
│      │  Header (64px)           │
│ Side ├──────────────────────────┤
│ bar  │  Nav bar (64px)          │
│      ├──────────────────────────┤
│      │  Contenido (scroll)      │
└──────┴──────────────────────────┘

MÓVIL:
┌─────────────────────────────────┐
│  Header (56px)                  │
├─────────────────────────────────┤
│  Nav bar (64px)                 │
├─────────────────────────────────┤
│  Contenido (scroll)             │
└─────────────────────────────────┘
```

Dos archivos, cambios mínimos.

