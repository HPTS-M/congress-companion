
Objetivo: hacer visible y clara la configuración de QR, porque hoy el código indica que existe en el Dashboard admin, pero en tu captura no aparece en pantalla y además no hay una sección explícita de “Configuración del evento”, lo que genera confusión.

Qué encontré
- El componente sí existe: `src/components/admin/EventSettingsCard.tsx`.
- Sí está insertado en `src/pages/admin/Dashboard.tsx`, debajo de “Actividad Reciente”.
- No existe una ruta o menú dedicado de configuración en el panel admin.
- En tu captura del Dashboard no se ve esa tarjeta, así que hay dos necesidades:
  1. corregir por qué no está apareciendo en la vista actual;
  2. moverla o duplicarla a un lugar mucho más evidente.

Plan propuesto

1. Verificar por qué la tarjeta no se está mostrando en el Dashboard
- Revisar la versión montada en preview/publicación frente al código actual.
- Confirmar si hay un problema de renderizado, caché, importación o despliegue.
- Validar que `EventSettingsCard` realmente se esté montando en la ruta `/:eventSlug/admin/dashboard`.

2. Crear una sección visible de configuración del evento
- Agregar una nueva página admin, por ejemplo `src/pages/admin/EventConfig.tsx`.
- Mostrar ahí la tarjeta de configuración QR con un título claro y descripción funcional.
- Mantener opcionalmente la tarjeta en Dashboard o dejar en Dashboard solo un acceso rápido.

3. Agregar la opción al menú lateral admin
- Incluir un nuevo ítem de navegación tipo “Configuración” o “Configuración del evento”.
- Ubicarlo cerca de Dashboard para que sea fácil de encontrar.
- Añadir sus textos en i18n `es/admin.json` y `en/admin.json`.

4. Conectar la nueva ruta en el enrutador
- Registrar la ruta admin nueva en `src/App.tsx`.
- Mantener el mismo `AdminLayout` y control de acceso actual.

5. Mejorar el texto para que no haya ambigüedad
- Cambiar el copy para explicar exactamente qué hace:
  - si está activo, la app muestra/permite funciones con QR;
  - si está inactivo, se ocultan o bloquean.
- Añadir una pequeña nota de impacto sobre Login, Check-in, Mi perfil y Tickets.

6. Validación funcional
- Probar el flujo completo:
  - activar QR y comprobar que aparecen las funciones;
  - desactivar QR y comprobar que desaparecen o se bloquean en la app de asistente.
- Revisar específicamente:
  - navegación inferior;
  - acceso a Check-in;
  - botón “Scan QR” en login;
  - QR en perfil;
  - QR en tickets.

Archivos previstos
- `src/pages/admin/EventConfig.tsx` (nuevo)
- `src/components/layout/AdminLayout.tsx`
- `src/App.tsx`
- `src/locales/es/admin.json`
- `src/locales/en/admin.json`
- Posiblemente `src/pages/admin/Dashboard.tsx` para dejar acceso rápido o quitar duplicación

Resultado esperado
- La configuración ya no dependerá de que el usuario la encuentre dentro del Dashboard.
- Existirá una sección explícita y visible en el panel admin.
- El toggle de QR será fácil de localizar y su efecto quedará claro.

Detalle técnico
- No hace falta migración de base de datos: ya se usa `events.settings.qr_enabled`.
- La lógica de ocultar funcionalidades QR en la app final ya existe; el trabajo principal es hacer visible, estable y verificable la configuración en el admin.
