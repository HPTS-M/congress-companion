

## Plan: Ocultar barra de navegación superior en desktop

### Problema
En desktop, la barra de acceso rápido (BottomNav reubicada arriba) se superpone visualmente al sidebar, duplicando los mismos enlaces (Inicio, Agenda, Tickets, etc.) y haciendo que el sidebar se pierda.

### Solución
Mostrar la barra superior solo en móvil (`md:hidden`), ya que en desktop el sidebar cumple la misma función. Ajustar el padding del contenido para que en desktop solo compense el header (sin la barra extra).

### Cambios

| Archivo | Cambio |
|---|---|
| `src/components/layout/BottomNav.tsx` | Agregar `md:hidden` al `<nav>` para ocultar en desktop |
| `src/components/layout/AttendeeLayout.tsx` | Cambiar padding de `<main>`: mantener `pt-[7.5rem]` en móvil (header + nav), pero en desktop usar `md:pt-16` (solo header, ya que la nav no se muestra) |

### Layout resultante

**Móvil:** Header → Barra de navegación → Contenido  
**Desktop:** Header → Sidebar (izq) + Contenido (der) — sin barra duplicada

