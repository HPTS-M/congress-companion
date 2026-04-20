

El usuario muestra que la URL es `congress-companion.vercel.app/ACQFH-2026/home` y la página está en blanco. El secret `APP_URL` aún apunta al dominio viejo de Vercel (`congress-companion.vercel.app`) en lugar del dominio publicado actual `congress-connect-app.lovable.app`.

Dos problemas distintos:

1. **El correo lleva al dominio incorrecto**: el secret `APP_URL` quedó como `https://congress-companion.vercel.app` (dominio Vercel viejo, probablemente ya no desplegado o sin la última versión de la app). Por eso la pantalla queda en blanco — no es un 404 limpio, es un dominio que ya no sirve la app correctamente.

2. **El helper `buildEventUrl` está funcionando correctamente**: ya no duplicó el slug. La URL salió `/ACQFH-2026/home` (bien formada). El problema ahora es solo el dominio base.

Necesito revisar logs para confirmar y luego presentar el fix: actualizar el secret al dominio correcto.

Voy a revisar logs rápido para confirmar mi diagnóstico antes de presentar el plan final.

