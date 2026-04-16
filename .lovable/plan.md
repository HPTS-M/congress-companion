

## Plan: Enlace de ubicación con Google Maps + copiar dirección

### Contexto
La sección "Info del Evento" en `Home.tsx` ya muestra `venue_name` + `venue_address` como texto plano. El usuario quiere convertir esa fila en algo accionable: abrir Google Maps y copiar la dirección al portapapeles.

### Comportamiento

```text
┌──────────────────────────────────────────────┐
│ 📅  18 Mar 2026 - 20 Mar 2026                │
│ 📍  Centro de Convenciones, Cra 7 #32-16     │
│      [🗺️ Abrir en Maps]  [📋 Copiar]         │
│ 👥  500 asistentes                           │
└──────────────────────────────────────────────┘
```

- **Abrir en Maps**: abre `https://www.google.com/maps/search/?api=1&query={encodeURIComponent(venue_name + venue_address)}` en una nueva pestaña.
- **Copiar**: usa `navigator.clipboard.writeText(...)` con la dirección completa, muestra toast "Dirección copiada" y cambia ícono a check por 2s.
- Solo se renderizan los botones si `event.venue_address` existe.

### Cambios

| Archivo | Cambio |
|---|---|
| `src/pages/attendee/Home.tsx` | Reestructurar la fila de ubicación: dirección arriba + dos botones debajo (`Abrir en Maps`, `Copiar`). Agregar handlers `handleOpenMaps` y `handleCopyAddress` con estado local `copied`. Importar `ExternalLink`, `Copy`, `Check` de lucide-react, `Button` de `@/components/ui/button`, `useToast` de `@/hooks/use-toast`. |
| `src/locales/es/common.json` | Agregar bajo `home`: `openInMaps: "Abrir en Maps"`, `copyAddress: "Copiar dirección"`, `addressCopied: "Dirección copiada"`. |
| `src/locales/en/common.json` | Agregar bajo `home`: `openInMaps: "Open in Maps"`, `copyAddress: "Copy address"`, `addressCopied: "Address copied"`. |

### Snippet de UI

```tsx
{event?.venue_name && (
  <div className="flex flex-col gap-2">
    <div className="flex items-start gap-3 text-sm text-foreground">
      <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
      <span>{event.venue_name}{event.venue_address ? `, ${event.venue_address}` : ''}</span>
    </div>
    {event.venue_address && (
      <div className="flex flex-wrap gap-2 pl-7">
        <Button size="sm" variant="outline" onClick={handleOpenMaps}>
          <ExternalLink className="h-3.5 w-3.5" /> {t('home.openInMaps')}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopyAddress}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t('home.copyAddress')}
        </Button>
      </div>
    )}
  </div>
)}
```

Cumple mobile-first (botones envuelven en pantallas pequeñas), sin texto hardcodeado, dark mode automático vía tokens.

