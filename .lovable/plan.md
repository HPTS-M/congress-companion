

## Plan — Agregar Encuestas al menú hamburguesa (mobile)

### Problema
En mobile, el módulo **Encuestas** (`/{event-slug}/polls`) no aparece en ningún lado:
- `BottomNav` solo muestra los 5 módulos de mayor prioridad (Polls queda 7°).
- `HamburgerMenu` nunca incluyó Polls en su lista.

Resultado: los asistentes no pueden contestar encuestas desde un teléfono.

### Solución
Agregar **Encuestas** como último ítem del menú hamburguesa, respetando el toggle `pollsEnabled` del evento.

### Cambios

**`src/components/layout/HamburgerMenu.tsx`**
- Importar el ícono `BarChart3` de `lucide-react` (mismo ícono que ya usan `BottomNav` y `AttendeeSidebar` para Polls — consistencia visual).
- Ampliar el tipo `SettingsKey` para incluir `'pollsEnabled'`.
- Agregar al final del array `menuItems` (justo después de `venueMap`):
  ```ts
  { key: 'polls', icon: BarChart3, path: '/polls', settingsKey: 'pollsEnabled' }
  ```

### Sin cambios en
- **i18n**: las claves `nav.polls` ya existen en `es/common.json` y `en/common.json` ("Encuestas" / "Polls").
- **`BottomNav`**: conserva su lógica de top-5 por prioridad.
- **`AttendeeSidebar` (desktop)**: ya tiene Polls.
- **Settings / RLS / servicios**: nada que tocar.
- **Filtro `pollsEnabled = false`**: si el organizador desactiva la feature, el ítem no aparece (filtro `visibleItems` ya existente lo oculta).

### Verificación
- Mobile (≤768px) con `pollsEnabled = true`: ícono 📊 Encuestas aparece como último ítem del hamburger, antes del separador y "Cerrar sesión".
- Mobile con `pollsEnabled = false`: no aparece.
- Desktop: sin cambios visibles (sidebar ya lo tenía).

### Archivos a modificar
| Archivo | Cambio |
|---|---|
| `src/components/layout/HamburgerMenu.tsx` | Importar `BarChart3`, agregar `'pollsEnabled'` al tipo, agregar entrada `polls` al final de `menuItems` |

### Esfuerzo
~2 minutos. Edición de un solo archivo, 3 líneas modificadas.

### Nota fuera de alcance
El sistema de prioridades fijas en `BottomNav` puede ocultar otros módulos en mobile cuando hay 5+ features activas. Vale la pena revisar en una próxima iteración si conviene permitir al admin elegir qué pestañas van en el bottom nav.

