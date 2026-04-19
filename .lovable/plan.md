

El usuario dice que la info del evento (fechas, dirección, número de asistentes) en Home se ve "quemada" (hardcoded) y debería ser configurable por el admin.

Reviso lo que ya tengo: leí `src/pages/attendee/Home.tsx` antes — los datos vienen de `useEvent()` que lee de la tabla `events`: `start_date`, `end_date`, `venue_name`, `venue_address`, `max_attendees`. **No están hardcoded — vienen de la BD.**

Pero el admin **no tiene UI** para editar estos campos. Reviso qué cards existen en `EventConfig.tsx`:
- `EventBrandingCard` → banner + logo
- `EventSettingsCard` → toggles QR / docs
- `EventVisibilityCard` → toggles módulos

❌ Falta una card para editar **datos básicos del evento**: nombre, descripción, fechas, venue, dirección, aforo.

Eso es lo que el usuario necesita. Plan corto y directo.

## Plan: Card de datos básicos del evento en configuración admin

### Diagnóstico
Los datos en Home (fechas, venue, aforo) **sí vienen de BD** (`events.start_date`, `venue_name`, `venue_address`, `max_attendees`), pero el admin **no tiene formulario para editarlos**. Hoy solo se pueden cambiar manualmente vía SQL o al crear el evento.

### Solución: nueva card `EventDetailsCard`

Crear `src/components/admin/EventDetailsCard.tsx` con formulario editable de:
- Nombre del evento (`name`)
- Descripción (`description`)
- Fecha inicio / fin (`start_date`, `end_date`) — date pickers
- Nombre del venue (`venue_name`)
- Dirección del venue (`venue_address`)
- Aforo máximo (`max_attendees`) — number input
- Coordenadas opcionales (`venue_coordinates` lat/lng) para mejor link a Google Maps

### Cambios concretos

1. **`src/components/admin/EventDetailsCard.tsx`** (NUEVO)
   - React Hook Form + Zod para validación (fechas coherentes, aforo > 0)
   - `useMutation` que actualiza `events` table e invalida `['event', eventSlug]`
   - Botón "Guardar cambios" deshabilitado hasta que haya cambios (`formState.isDirty`)
   - Toast de éxito/error
   - Skeleton mientras carga
   - Dark mode + i18n

2. **`src/pages/admin/EventConfig.tsx`**
   - Insertar `<EventDetailsCard />` como **primera card** (antes de Branding)

3. **`src/locales/{es,en}/admin.json`**
   - Nuevas claves bajo `settings.details.*`: title, description, fields (name, description, dates, venue, address, capacity, coordinates), validations, save button, success/error toasts

4. **(Opcional) Mejora en Home**: si `venue_coordinates` está presente, usar `https://www.google.com/maps/search/?api=1&query=lat,lng` en lugar de buscar por texto — link más preciso.

### Buenas prácticas aplicadas
- **Backend-first**: la tabla `events` ya tiene todas las columnas (verificado en schema). Solo se añade UI.
- **RLS intacto**: política existente "Admins can manage events in organization" cubre los UPDATE.
- **Validación con Zod**: fechas coherentes (`end_date >= start_date`), aforo entero positivo.
- **i18n completo**: cero strings hardcoded.
- **TanStack Query**: invalidar `['event', eventSlug]` para que Home y dashboard reflejen cambios al instante.
- **Dark mode**: todas las clases con `dark:` variants.
- **Mobile-first**: form responsivo, inputs con touch targets ≥44px.
- **Accesibilidad**: labels asociados a inputs, mensajes de error con `aria-describedby`.
- **UX**: botón guardar deshabilitado sin cambios; confirmación al cambiar fechas si hay sesiones de agenda fuera del nuevo rango (warning, no bloqueo).

### Verificación post-cambios
| # | Prueba | Criterio |
|---|---|---|
| 1 | Cambiar nombre del evento + guardar | Home y header reflejan nuevo nombre tras invalidar query |
| 2 | Cambiar fechas | Home muestra el nuevo rango formateado |
| 3 | Cambiar aforo a 750 | Home muestra "750 asistentes" |
| 4 | Cambiar venue + dirección | Home actualiza, "Abrir en Maps" usa nueva dirección |
| 5 | Validación: end_date < start_date | Form muestra error, no permite guardar |
| 6 | Validación: aforo = 0 o negativo | Form muestra error |
| 7 | Mobile 360px | Form usable, sin overflow |
| 8 | Dark mode | Inputs y labels con contraste correcto |
| 9 | Cambios sin guardar + navegar fuera | (opcional) prompt "tienes cambios sin guardar" |
| 10 | i18n: cambiar a inglés | Todas las etiquetas cambian |

