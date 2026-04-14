
Objetivo: resolver por qué “Configuración del Evento” no aparece en el panel admin y dejar la opción de QR claramente visible.

Lo que confirmé en el código
- Sí existe la página: `src/pages/admin/EventConfig.tsx`
- Sí existe la ruta: `/:eventSlug/admin/config` en `src/App.tsx`
- Sí existe el ítem de menú: `config` en `src/components/layout/AdminLayout.tsx`
- Sí existen los textos i18n: `nav.config` y `settings.*` en `src/locales/es/admin.json` y `en/admin.json`

Lo que muestra tu captura
- El panel visible sigue mostrando el menú antiguo.
- No aparece “Configuración”, así que lo que estás viendo no coincide con el código actual que ya la incluye.

Plan de acción

1. Verificar desajuste entre código y app visible
- Revisar si el preview/publicado está sirviendo una versión anterior del admin.
- Confirmar que el `AdminLayout` activo sea el mismo archivo que ya contiene `config`.
- Validar que la ruta `/:eventSlug/admin/config` cargue en la versión que estás viendo.

2. Hacer la configuración imposible de perder
- Mantener la página dedicada `EventConfig`.
- Agregar además un acceso visible desde el Dashboard:
  - botón “Configuración del evento”, o
  - tarjeta de acceso rápido arriba de “Actividad reciente”.
- Así, aunque el menú lateral falle o tarde en reflejarse, el ajuste seguirá estando accesible.

3. Endurecer la navegación admin
- Confirmar que el sidebar marque correctamente el ítem “Configuración”.
- Revisar que no haya lógica de layout, caché o lazy loading impidiendo que se renderice el nuevo ítem.
- Verificar que la navegación apunte a `/${eventSlug}/admin/config`.

4. Reforzar el copy de la sección
- Dejar claro que el switch de QR controla:
  - botón “Scan QR” en login,
  - pestaña Check-in,
  - QR en Mi Perfil,
  - QR en Tickets.
- Mantener el texto ya agregado en `admin.json`, ajustándolo si hace falta para más claridad.

5. Validación final
- Probar en preview y publicado:
  - menú lateral con “Configuración” visible,
  - acceso directo a `/admin/config`,
  - toggle guardando correctamente en `events.settings.qr_enabled`,
  - app de asistentes mostrando/ocultando funciones QR al cambiar el switch.
- Revisar desktop y móvil.

Archivos a intervenir
- `src/components/layout/AdminLayout.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/EventConfig.tsx`
- `src/App.tsx`
- `src/locales/es/admin.json`
- `src/locales/en/admin.json`

Resultado esperado
- Verás una sección clara de “Configuración” dentro del panel admin.
- El control de QR será visible tanto desde menú como desde Dashboard.
- Ya no dependerá de encontrar una tarjeta escondida o de una versión inconsistente del panel.
