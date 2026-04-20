

## Plan: Ocultar accesos rápidos del top-bar en escritorio

### Diagnóstico

Los "accesos rápidos" (Inicio, Agenda, Check-in, Tickets, Comercial, Encuestas) viven en el componente `BottomNav.tsx` que, pese a su nombre, en escritorio se posiciona **arriba** (debajo del header) gracias a `fixed top-14 md:top-16`. En móvil cumple su rol de bottom navigation; en escritorio aparece como una barra horizontal redundante porque el `AttendeeSidebar` lateral ya lista esos mismos accesos en el grupo "Principal".

Decisión confirmada por el usuario: **ocultar la barra completa en escritorio** (md ≥ 768px). Check-in sigue accesible desde el sidebar lateral.

### Cambios concretos

**1. `src/components/layout/BottomNav.tsx`**
- Añadir `md:hidden` al `<nav>` para que solo se renderice en móvil/tablet pequeño.
- La barra deja de ocupar espacio visual y deja de interceptar layout en escritorio.

**2. `src/components/layout/AttendeeLayout.tsx`**
- Ajustar el padding superior del `<main>`: actualmente `pt-[7.5rem] md:pt-[8.5rem]` reserva espacio para header (56/64px) + BottomNav (64px). En escritorio ya no existe la BottomNav, así que el padding md baja a solo el header (~64px + offline banner).
- Cambiar `pt-[7.5rem] pb-0 md:pt-[8.5rem] md:pb-0` por `pt-[7.5rem] pb-0 md:pt-16` (1rem de respiro adicional opcional, ajustable).

### Sin cambios en

- `AttendeeSidebar.tsx` — los mismos accesos siguen disponibles en el lateral.
- Comportamiento móvil — la BottomNav sigue funcionando exactamente igual en < md.
- Filtros por `eventSettings` — se mantienen.

### Verificación

1. Viewport 1202×628 (escritorio): la barra de 6 íconos bajo el header ya no aparece. El contenido principal sube y queda inmediatamente debajo del header/offline banner.
2. Viewport 375px (móvil): la barra sigue arriba como hoy (queda igual).
3. Sidebar lateral en escritorio: Inicio, Agenda, Check-in, Tickets, Comercial, Encuestas siguen presentes y navegables en el grupo "Principal".

