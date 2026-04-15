

## Plan: Mover iconos de acceso rápido debajo del banner del asistente

### Cambio

Mover la sección "Quick Access Icons" (líneas 64-83) para que aparezca **inmediatamente después del banner con el nombre del asistente** (línea 53), y **antes** del QR Card (línea 56).

### Layout resultante

```text
┌─────────────────────────────────┐
│  Daniel Sanchez        Confirmado│
│  Asistente                       │
├─────────────────────────────────┤
│  🏠    📅    🎫    🏢    📊    │
│ Inicio Agenda Tickets Comerc Encue│
├─────────────────────────────────┤
│         Banner / Logo           │
├─────────────────────────────────┤
│       Información del evento    │
└─────────────────────────────────┘
```

### Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/attendee/Home.tsx` | Cortar el bloque "Quick Access Icons" (líneas 64-83) y pegarlo entre el cierre del Top Banner (línea 53) y el QR Card (línea 56). Ajustar margins: `mx-4 mt-4` en vez de `mx-4 mt-6`. |

Un solo archivo, reordenamiento de bloques existentes.

