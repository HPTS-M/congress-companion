

## Plan: Configuración de Branding y Gestión de Permisos (Módulo de Visibilidad)

### Resumen

Ampliar la página de configuración del evento (`EventConfig`) con dos nuevas secciones: (1) carga y configuración de banner/branding del evento, y (2) parametrización de visibilidad de módulos para la app del asistente.

---

### 1. Branding y Diseño — Banner del evento

**Problema:** Actualmente el banner/logo del evento está hardcodeado (`/logo-congreso.png`, `/logo-acqfh-v2.jpg`). No hay forma de configurarlo por evento.

**Solución:** Almacenar la URL del banner en `events.settings` como `banner_url` y `header_logo_url`. Crear un componente de upload que suba imágenes al bucket `event-sponsors` (reutilizando el existente) bajo la carpeta `{event_id}/branding/`. El admin podrá:
- Subir imagen de banner (mostrada en Home del asistente)
- Subir logo del header (mostrado en AppHeader)
- Preview en tiempo real antes de guardar

**Archivos a modificar:**

| Archivo | Ruta | Acción |
|---|---|---|
| `src/types/index.ts` | `src/types/index.ts` | Ampliar `EventSettings` con `banner_url?`, `header_logo_url?` |
| `src/components/admin/EventBrandingCard.tsx` | **Nuevo** | Card con upload de banner y logo, preview, guardado en `events.settings` |
| `src/pages/admin/EventConfig.tsx` | `src/pages/admin/EventConfig.tsx` | Agregar `<EventBrandingCard />` |
| `src/pages/attendee/Home.tsx` | `src/pages/attendee/Home.tsx` | Usar `settings.banner_url` en vez de `/logo-congreso.png` hardcodeado |
| `src/components/layout/AppHeader.tsx` | `src/components/layout/AppHeader.tsx` | Usar `settings.header_logo_url` en vez de `/logo-acqfh-v2.jpg` hardcodeado |
| `src/locales/es/admin.json` | `src/locales/es/admin.json` | Nuevas claves `settings.branding.*` |
| `src/locales/en/admin.json` | `src/locales/en/admin.json` | Nuevas claves `settings.branding.*` |

**Flujo de upload:**
1. Admin selecciona imagen → se sube a `event-sponsors/{event_id}/branding/banner.webp`
2. Se genera signed URL
3. Se guarda la URL en `events.settings.banner_url`
4. La Home del asistente lee `settings.banner_url` y la usa como `src`

---

### 2. Gestión de Permisos — Visibilidad de módulos

**Problema:** Actualmente solo existe el toggle de QR. No hay forma de ocultar otros módulos (Contactos, Documentos, Notas, Mensajería, Encuestas, Ratings, Mapa, etc.).

**Solución:** Agregar toggles en `events.settings` para cada módulo configurable. Los componentes de navegación (`BottomNav`, `AttendeeSidebar`, `HamburgerMenu`) consultarán estos settings para filtrar items visibles.

**Módulos configurables (toggles):**

| Clave en settings | Módulo | Default |
|---|---|---|
| `qr_enabled` | Check-in / QR (ya existe) | `true` |
| `contacts_enabled` | Contactos / Networking | `true` |
| `documents_enabled` | Documentos | `true` |
| `notes_enabled` | Notas | `true` |
| `messaging_enabled` | Mensajería directa | `true` |
| `announcements_enabled` | Anuncios | `true` |
| `ratings_enabled` | Valoraciones | `true` |
| `venue_map_enabled` | Mapa del evento | `true` |
| `polls_enabled` | Encuestas | `true` |
| `tickets_enabled` | Tickets / Servicios | `true` |
| `commercial_enabled` | Directorio Comercial | `true` |

**Archivos a modificar:**

| Archivo | Ruta | Acción |
|---|---|---|
| `src/types/index.ts` | `src/types/index.ts` | Ampliar `EventSettings` con todas las claves `*_enabled` |
| `src/hooks/useEvent.ts` | `src/hooks/useEvent.ts` | Ampliar `useEventSettings()` para retornar todos los flags |
| `src/components/admin/EventVisibilityCard.tsx` | **Nuevo** | Card con grid de toggles, un Switch por módulo |
| `src/pages/admin/EventConfig.tsx` | `src/pages/admin/EventConfig.tsx` | Agregar `<EventVisibilityCard />` |
| `src/components/layout/BottomNav.tsx` | `src/components/layout/BottomNav.tsx` | Filtrar tabs según settings (`tickets_enabled`, `commercial_enabled`, `polls_enabled`) |
| `src/components/layout/AttendeeSidebar.tsx` | `src/components/layout/AttendeeSidebar.tsx` | Filtrar items según settings |
| `src/components/layout/HamburgerMenu.tsx` | `src/components/layout/HamburgerMenu.tsx` | Filtrar items según settings |
| `src/locales/es/admin.json` | `src/locales/es/admin.json` | Nuevas claves `settings.visibility.*` |
| `src/locales/en/admin.json` | `src/locales/en/admin.json` | Nuevas claves `settings.visibility.*` |

**Implementacion de filtrado en navegación:**

Cada item de nav tendrá una propiedad `settingsKey` opcional. `useEventSettings()` retornará un objeto con todos los flags. Los componentes harán `.filter(item => !item.settingsKey || settings[item.settingsKey] !== false)`.

---

### 3. No se requieren migraciones de BD

Toda la configuración se almacena en la columna JSONB `events.settings` que ya existe. No hay cambios de esquema.

---

### Estructura final de EventConfig

```text
EventConfig.tsx
├── EventBrandingCard       (Banner + Logo upload)
├── EventSettingsCard        (QR toggle — ya existe, se mantiene)
└── EventVisibilityCard     (Grid de toggles de módulos)
```

### Orden de implementación
1. Ampliar `EventSettings` type y `useEventSettings()` hook
2. Crear `EventBrandingCard` con upload a storage
3. Crear `EventVisibilityCard` con toggles
4. Actualizar `EventConfig.tsx` con las 3 cards
5. Actualizar navegación (`BottomNav`, `AttendeeSidebar`, `HamburgerMenu`) para filtrar por settings
6. Actualizar `Home.tsx` y `AppHeader.tsx` para usar branding dinámico
7. Agregar claves i18n en es/en

