

## Plan: Restaurar barra de navegación inferior en escritorio

### Problema
La barra inferior (Inicio, Agenda, Tickets, Comercial, Encuestas) tiene la clase `md:hidden` en `BottomNav.tsx` (línea 30), lo que la oculta en pantallas ≥768px. Esto se añadió cuando se implementó el sidebar de escritorio.

### Solución
Eliminar `md:hidden` de la clase del `<nav>` en `BottomNav.tsx` para que la barra inferior sea visible tanto en móvil como en escritorio.

### Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/components/layout/BottomNav.tsx` | Quitar `md:hidden` de la clase del `<nav>` en línea 30 |

Cambio de una sola línea. El sidebar desktop seguirá funcionando en paralelo.

