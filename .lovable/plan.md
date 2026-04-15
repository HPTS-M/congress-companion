

## Plan: Reubicar iconos de acceso rápido a zona superior

### Problema
Los iconos de navegación (Inicio, Agenda, Tickets, Comercial, Encuestas) están fijos en la barra inferior. El usuario quiere que estén en la zona superior de la pantalla principal (Home).

### Solución
Crear una barra de acceso rápido horizontal debajo del banner en `Home.tsx` con los mismos 5 iconos/enlaces. La barra inferior (`BottomNav`) se mantiene en móvil pero se puede ocultar en desktop con `md:hidden` ya que el sidebar desktop cubre esa función.

### Implementación

| Archivo | Cambio |
|---|---|
| `src/pages/attendee/Home.tsx` | Agregar sección de iconos de acceso rápido (grid horizontal) debajo del QR Card, con los 5 enlaces: Home, Agenda, Tickets, Comercial, Encuestas. Cada uno con icono + label, enlace a la ruta correspondiente. Filtrados por `useEventSettings()` igual que BottomNav. |
| `src/locales/es/common.json` | Agregar clave `home.quickAccess` si no existe |
| `src/locales/en/common.json` | Agregar clave `home.quickAccess` si no existe |

### Diseño de la sección

```text
┌─────────────────────────────────┐
│         Banner / Logo           │
├─────────────────────────────────┤
│  🏠    📅    🎫    🏢    📊    │
│ Inicio Agenda Tickets Comerc Encue│
├─────────────────────────────────┤
│       Información del evento    │
└─────────────────────────────────┘
```

- Grid de 5 columnas con iconos circulares sobre fondo `bg-primary/10`
- Cada icono es un `Link` a la ruta correspondiente
- Respeta los toggles de visibilidad (`ticketsEnabled`, `commercialEnabled`, `pollsEnabled`)
- Estilo: icono 24px dentro de círculo 48px, label 11px debajo

### Orden
1. Agregar claves i18n
2. Agregar sección de acceso rápido en Home.tsx

