

## Plan: Tooltips descriptivos en todos los iconos del header

### Diagnóstico

En `AppHeader.tsx` solo el botón de mensajes tiene tooltip (vía `title` HTML nativo). Los demás iconos no muestran ninguna pista al pasar el cursor:

| Icono | Tooltip actual | Estado |
|---|---|---|
| 🌐 Idioma | Ninguno | ❌ Falta |
| 🔔 Campana (móvil) | Ninguno (solo `aria-label`) | ❌ Falta |
| 💬 Mensajes (móvil) | `title` HTML nativo | ⚠️ Inconsistente (no usa el componente Tooltip) |
| 👤 Perfil | Ninguno | ❌ Falta |

El proyecto ya tiene `src/components/ui/tooltip.tsx` (Radix) y `TooltipProvider` ya está montado en `App.tsx`, así que no hace falta agregar dependencias ni providers.

### Decisión

Envolver los 4 botones del header con el componente `Tooltip` de shadcn/ui (Radix), reemplazando el `title` nativo del botón de mensajes para tener un comportamiento visual y de accesibilidad consistente. Los tooltips se muestran en hover (escritorio) y mantienen `aria-label` para lectores de pantalla.

| Icono | Tooltip (es) | Tooltip (en) |
|---|---|---|
| 🌐 Idioma | "Cambiar idioma" | "Change language" |
| 🔔 Campana | "Anuncios" (+ contador si > 0) | "Announcements" |
| 💬 Mensajes | "Mensajería" (o "Sin conexión" si offline) | "Messaging" |
| 👤 Perfil | "Mi Perfil" | "My Profile" |

Comportamiento:
- Tooltip aparece en hover (~500 ms delay por defecto de Radix).
- En móvil/touch los tooltips no se muestran (Radix los desactiva en touch), pero `aria-label` sigue funcionando para accesibilidad.
- Si el botón está oculto (`md:hidden`), el tooltip simplemente no se renderiza — sin efectos colaterales.

### Cambios concretos

**1. `src/components/layout/AppHeader.tsx`**
- Importar `Tooltip, TooltipTrigger, TooltipContent` desde `@/components/ui/tooltip`.
- Envolver cada uno de los 4 botones (idioma, campana, mensajes, perfil) en:
  ```tsx
  <Tooltip>
    <TooltipTrigger asChild>
      <Button …>…</Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {tooltipLabel}
    </TooltipContent>
  </Tooltip>
  ```
- Eliminar el `title="…"` HTML nativo del botón de mensajes (lo reemplaza el Tooltip).
- Mantener todos los `aria-label` existentes para accesibilidad.
- Usar `side="bottom"` para que aparezcan debajo del header gradient (mejor contraste con el fondo blanco del popover).

**2. `src/locales/es/common.json` y `src/locales/en/common.json`**
- Agregar bajo nueva clave `header.tooltips`:
  - `language`: "Cambiar idioma" / "Change language"
  - `announcements`: "Anuncios" / "Announcements"
  - `profile`: "Mi Perfil" / "My Profile"
- Reusar la clave existente `messaging:headerTooltip` para mensajes (ya dice "Mensajería").
- Reusar `offlineBanner.headerDot` para el caso de mensajes sin conexión.

**3. Sin cambios en**
- `App.tsx` — `TooltipProvider` ya está montado globalmente.
- `tooltip.tsx`, `BottomNav`, `HamburgerMenu`, `AttendeeSidebar` — ningún tooltip allí (los items de sidebar tienen labels visibles).
- Lógica de `markAsSeen`, navegación, badges — sin tocar.

### Resultado esperado

| Acción usuario | Antes | Después |
|---|---|---|
| Hover sobre 🌐 idioma (escritorio) | Nada | Tooltip "Cambiar idioma" |
| Hover sobre 🔔 campana (móvil c/ mouse externo) | Nada | Tooltip "Anuncios" |
| Hover sobre 💬 mensajes | Tooltip nativo del navegador (feo) | Tooltip estilizado consistente |
| Hover sobre 👤 perfil | Nada | Tooltip "Mi Perfil" |
| Tap en móvil táctil | Sin cambios — navega directo | Sin cambios — navega directo |
| Lector de pantalla | `aria-label` activo | `aria-label` activo (sin cambios) |

### Verificación post-deploy

1. Login asistente en `ACQFH-2026` desde escritorio → hover sobre cada uno de los 4 iconos del header → confirmar que aparece el tooltip estilizado debajo del icono con el texto correcto.
2. Cambiar idioma a EN → hover sobre los iconos → confirmar tooltips en inglés ("Change language", "My Profile", etc.).
3. Apagar red → hover sobre 💬 mensajes → confirmar tooltip "Sin conexión" / "Offline".
4. Móvil táctil (375 px) → tap en iconos → confirmar que la navegación funciona y no aparecen tooltips persistentes.
5. Probar con lector de pantalla (VoiceOver/NVDA) → confirmar que `aria-label` sigue siendo anunciado al enfocar cada botón.

