

## Plan: Simplificar la página de inicio del asistente

### Diagnóstico

Hoy el `Home.tsx` (`/:eventSlug`, ruta principal del asistente al hacer login) tiene un **banner azul superior** con 3 elementos que el usuario quiere eliminar:

| Elemento | Ubicación actual | Acción |
|---|---|---|
| Nombre del asistente (`attendee.full_name`) | Banner azul, texto grande blanco | **Eliminar** |
| Paquete / "perfil" (`selected_package_id` o "Asistente") | Banner azul, subtexto blanco | **Eliminar** |
| Badge de estado "Confirmado" | Banner azul, esquina superior derecha | **Eliminar** |

El resto de la página (logo del congreso, info del evento con fecha, sede, número de asistentes, botones "Abrir en Maps" y "Copiar dirección") se conserva intacto.

### Decisión

Eliminar **completamente el banner azul superior** del `Home.tsx`. Esa franja deja de renderizarse — no se reemplaza por otro elemento. La página queda con el logo del congreso como primer elemento visible y debajo la sección "Info del Evento".

El nombre, paquete y estado del asistente siguen siendo accesibles desde:
- **Mi Perfil** (`/profile`, icono 👤 en el header) — muestra nombre, email, especialidad, institución, código de credencial.
- **Header** — el icono de perfil sigue presente para acceso rápido.

No se pierde información — solo se simplifica la vista de inicio.

### Cambios concretos

**`src/pages/attendee/Home.tsx`**
- Eliminar todo el bloque `<div className="relative bg-primary px-4 py-5">…</div>` (las 3 líneas de nombre, paquete y badge de estado).
- El primer elemento visible pasa a ser el card del logo (`bannerSrc`).
- Ajustar el margen superior del card del logo: cambiar `mt-4` por `mt-6` para que respire bien sin el banner arriba.
- Limpiar imports que dejen de usarse: el badge `t('status.confirmed')` deja de invocarse, pero `useAuth` se mantiene por si se necesita en el futuro (o se elimina si queda completamente sin uso — lo verificaré al implementar).

**Sin cambios en:**
- Header (`AppHeader.tsx`) — los iconos de idioma y perfil se conservan tal cual.
- `MyProfile.tsx` — toda la info personal sigue accesible ahí.
- Estructura de rutas, hooks, servicios o i18n — no hay strings nuevos.
- Móvil ni escritorio — el cambio se aplica por igual a ambos viewports (la página es la misma componente responsive).

### Resultado esperado

| Elemento | Antes | Después |
|---|---|---|
| Banner azul superior | Visible con nombre + paquete + badge | **Eliminado** |
| Logo del congreso | Segundo elemento | Primer elemento |
| Card "Info del Evento" | Tercer elemento | Segundo elemento |
| Acceso a perfil del asistente | Banner + icono header | Solo icono header (👤) |

### Verificación post-deploy

1. Login como asistente en `ACQFH-2026` → confirmar que la página `/ACQFH-2026` ya no muestra el banner azul con nombre y paquete.
2. Confirmar que el logo del congreso es el primer elemento visible debajo del header.
3. Confirmar que la sección "Info del Evento" (fecha, sede, asistentes, botones de Maps) sigue funcionando igual.
4. Click en el icono de perfil 👤 del header → confirmar que `MyProfile` sigue mostrando nombre, paquete y demás datos personales.
5. Probar en móvil (375 px) y escritorio (1200 px) → ambos deben mostrar la misma página simplificada.

