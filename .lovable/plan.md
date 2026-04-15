

## Plan: Mostrar barra de navegación superior en móvil y desktop

### Problema
La barra de navegación tiene `md:hidden`, así que desaparece en desktop. El usuario quiere que sea visible en ambos, coexistiendo con el sidebar en desktop.

### Cambios

| Archivo | Cambio |
|---|---|
| `src/components/layout/BottomNav.tsx` | Quitar `md:hidden` del `<nav>`. Agregar `md:left-[var(--sidebar-width)]` para que en desktop empiece después del sidebar y no se superponga. Usar `md:top-16` para alinearse con el header de 64px en desktop. |
| `src/components/layout/AttendeeLayout.tsx` | Cambiar padding de `<main>` a `pt-[7.5rem]` en móvil y `md:pt-[7.5rem]` en desktop (header + nav en ambos). |

### Layout resultante

**Móvil:** Header (56px) → Nav bar (64px) → Contenido  
**Desktop:** Header (64px) → Sidebar (izq) + [Nav bar (64px) → Contenido] (der)

La nav bar en desktop se desplaza a la derecha del sidebar, ocupando solo el ancho restante.

