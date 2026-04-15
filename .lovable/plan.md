

## Plan: Mover la barra de navegación debajo del banner del asistente

### Problema
La barra de navegación está fija debajo del header (posición global). El usuario quiere que esté debajo del banner azul que muestra el nombre del asistente ("Daniel Sanchez" / "Asistente"). Este banner actualmente solo existe en Home.tsx.

### Solución
1. Extraer el banner del asistente de `Home.tsx` al layout (`AttendeeLayout.tsx`) para que sea visible en todos los módulos.
2. Colocar la barra de navegación (`BottomNav`) justo debajo de ese banner, ambos fijos.
3. Ajustar el padding del contenido para compensar los 3 elementos fijos: header + banner + nav.

### Layout resultante

```text
┌─────────────────────────────────┐  ← Header fijo (56px móvil / 64px desktop)
│  ≡  Logo  Event Name    🌐 🔔 👤│
├─────────────────────────────────┤  ← Banner asistente (~60px), fijo
│  Daniel Sanchez        Confirmado│
├─────────────────────────────────┤  ← Nav fija (64px)
│ Inicio  Agenda  Check-in  ...   │
├─────────────────────────────────┤
│       Contenido del módulo      │
│       (scroll)                  │
└─────────────────────────────────┘
```

### Cambios

| Archivo | Cambio |
|---|---|
| `src/components/layout/AttendeeLayout.tsx` | Agregar un nuevo componente `AttendeeBanner` fijo debajo del header que muestre nombre + paquete + badge "confirmado". Mover `<BottomNav />` debajo del banner. Ajustar padding de `<main>` a ~`pt-[12.5rem]` (56+60+64 = 180px) en móvil. |
| `src/components/layout/BottomNav.tsx` | Cambiar `top-14` a `top-[7.5rem]` aprox (header + banner). Mantener `md:left-[var(--sidebar-width)]`. |
| `src/pages/attendee/Home.tsx` | Eliminar el bloque "Top Banner" (líneas 24-35) ya que ahora vive en el layout. |

### Detalle técnico
- El banner del asistente necesita acceso a `useAuth()` para `attendee.full_name` y `attendee.registration_status`, que ya está disponible en el contexto.
- Se creará como componente inline o separado dentro de `AttendeeLayout.tsx`.
- En desktop, el banner también respeta `md:left-[var(--sidebar-width)]` como la nav.

