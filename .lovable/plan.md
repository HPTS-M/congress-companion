
Objetivo: hacer que “Configuración” sí aparezca de forma visible en el panel admin y asegurar que el toggle de QR sea accesible aunque haya un desfase entre código y app publicada/preview.

Lo que confirmé
- El código ya incluye el menú “Configuración” en `src/components/layout/AdminLayout.tsx`.
- La ruta `/:eventSlug/admin/config` ya existe en `src/App.tsx`.
- El Dashboard ya tiene un botón rápido hacia Configuración en `src/pages/admin/Dashboard.tsx`.
- La página `src/pages/admin/EventConfig.tsx` sí renderiza `EventSettingsCard`.

Lo que indica tu captura
- En la app visible no aparece ni el ítem lateral “Configuración” ni el botón rápido del Dashboard.
- Eso significa que la interfaz que estás viendo no coincide con el código actual; el problema principal parece ser de sincronización/publicación del frontend, no de ausencia de código.

Plan propuesto

1. Confirmar el desfase entre código y frontend visible
- Verificar si el preview o el sitio publicado siguen sirviendo una versión anterior.
- Confirmar cuál de las dos URLs está mostrando el menú viejo.
- Revisar si falta publicar el último cambio de frontend.

2. Dejar Configuración visible por duplicado
- Mantener la ruta dedicada `/admin/config`.
- Mantener también el acceso rápido desde Dashboard.
- Así el ajuste seguirá accesible incluso si el sidebar tarda en reflejar cambios.

3. Reforzar la navegación admin
- Revisar el sidebar para asegurar que el item `config` quede en una posición visible.
- Validar que el enlace use correctamente `/${eventSlug}/admin/config`.
- Confirmar que el estado activo del menú funcione al entrar a Configuración.

4. Verificar el contenido de la página de configuración
- Confirmar que `EventConfig` cargue `EventSettingsCard`.
- Validar que el copy explique claramente el impacto del QR sobre Login, Check-in, Mi Perfil y Tickets.

5. Validación final
- Probar en preview y publicado:
  - menú lateral con “Configuración”,
  - botón rápido en Dashboard,
  - acceso directo a `/admin/config`,
  - guardado de `events.settings.qr_enabled`,
  - ocultamiento/bloqueo de funciones QR en la app del asistente.

Archivos involucrados
- `src/components/layout/AdminLayout.tsx`
- `src/App.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/EventConfig.tsx`
- `src/components/admin/EventSettingsCard.tsx`
- `src/locales/es/admin.json`
- `src/locales/en/admin.json`

Detalle técnico
- No hace falta migración: el toggle ya usa `events.settings.qr_enabled`.
- La mayor señal actual es que el frontend visible no está mostrando cambios que sí están en el repositorio.
- Al implementar, además del ajuste de UI, habrá que confirmar publicación/sincronización del frontend para que realmente lo veas en pantalla.

Resultado esperado
- Verás “Configuración” en el menú admin.
- También tendrás un acceso visible desde el Dashboard.
- Desde ahí podrás activar o desactivar QR y su efecto se reflejará en la app de asistentes.
