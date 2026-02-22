

# Plan: Corregir Home Screen — campos faltantes y padding del QR

## Problema 1: Tipo de paquete no se muestra

El banner muestra `attendee.selected_package_id` que es `null` para el asistente de prueba. Ademas, `selected_package_id` es un UUID (referencia a otra tabla), no el nombre legible del paquete.

**Solucion:** Como no existe tabla `packages` en la base de datos, y el campo es null, hay dos cosas que hacer:

1. Actualizar el asistente de prueba con un valor descriptivo temporal (ej: "Estandar") en un campo apropiado, O mostrar un fallback como "Asistente" cuando no hay paquete.
2. Dado que no hay tabla de paquetes, mostrar un texto fallback cuando `selected_package_id` es null.

**Cambio en `Home.tsx` linea 23-24:**
- Si `selected_package_id` existe, mostrarlo (en el futuro se resolvera el nombre del paquete)
- Si es null, mostrar un fallback traducido como "Asistente" / "Attendee"

Agregar claves i18n:
- `home.packageFallback`: "Asistente" (es) / "Attendee" (en)

## Problema 2: Conteo de asistentes siempre muestra 0

La linea 78 tiene `count: 0` hardcodeado. Se necesita consultar el conteo real de asistentes del evento.

**Solucion:** 
- Agregar `max_attendees` al tipo `CongressEvent` y a la query de `useEventLoader`
- En `Home.tsx`, usar `event.max_attendees` si existe, o hacer un conteo real de asistentes registrados
- La opcion mas simple: agregar un query en Home para contar asistentes del evento, o usar `max_attendees` del evento

Dado que `max_attendees` es null y solo hay 1 asistente real, la mejor opcion es:
- Consultar `COUNT(*)` de `attendees` para el evento actual
- Mostrar ese numero real

**Pero** la tabla `attendees` tiene RLS `block_anon_access`. El usuario ya esta autenticado via JWT custom, no via Supabase Auth, asi que las queries desde el frontend usan el rol `anon`.

**Alternativa practica:** Usar `max_attendees` del campo del evento (ya disponible sin query extra). Actualizar el evento de prueba con `max_attendees = 500`. Y agregar el campo al tipo y a la query.

## Problema 3: Padding del QR card

La tarjeta QR usa `p-6` (24px uniforme). El usuario pide `py-8` (32px vertical).

**Cambio en linea 34:** Cambiar `p-6` a `px-6 py-8`.

---

## Cambios archivo por archivo

### 1. `src/types/index.ts`
- Agregar `max_attendees: number | null` a `CongressEvent`

### 2. `src/hooks/useEvent.ts`
- Agregar `max_attendees` a la lista de columnas en el SELECT (linea 24)

### 3. `src/pages/attendee/Home.tsx`
- Linea 23-24: Mostrar fallback i18n cuando no hay paquete
- Linea 34: Cambiar `p-6` a `px-6 py-8`
- Linea 78: Cambiar `count: 0` a `count: event?.max_attendees ?? 0`

### 4. `src/locales/es/common.json` y `src/locales/en/common.json`
- Agregar `home.packageFallback`: "Asistente" / "Attendee"

### 5. Migracion SQL
- Actualizar el evento ACQFH-2026: `UPDATE events SET max_attendees = 500 WHERE event_code = 'ACQFH-2026'`

