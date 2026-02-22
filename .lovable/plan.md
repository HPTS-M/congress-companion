

# Plan: Crear datos de prueba con el Congreso ACQFH 2026

## Resumen

Insertar datos reales del XIII Congreso Nacional de Farmacia Hospitalaria 2026 de la ACQFH para poder probar el flujo de login con el usuario `dsc747@hotmail.com`.

## Datos del evento (extraidos del sitio web)

- **Nombre:** XIII Congreso Nacional de Farmacia Hospitalaria
- **Organizacion:** ACQFH - Asociacion Colombiana de Q.F. Hospitalario
- **Ciudad:** Medellin, Colombia
- **Codigo del evento:** `ACQFH-2026`
- **Fechas:** Por definir exactas en el sitio (usaremos marzo 2026 como estimacion)

## Datos del asistente de prueba

- **Email:** dsc747@hotmail.com
- **Nombre:** Usuario de Prueba
- **Codigo de acceso:** `TEST1234` (8 caracteres alfanumericos)
- **Hash:** bcrypt del codigo `TEST1234`
- **Estado:** confirmed

## Pasos de implementacion

### Paso 1 — Crear organizacion ACQFH

Insertar un registro en la tabla `organizations` con:
- name: "ACQFH - Asociacion Colombiana de Q.F. Hospitalario"
- slug: "acqfh"

### Paso 2 — Crear evento

Insertar en la tabla `events`:
- name: "XIII Congreso Nacional de Farmacia Hospitalaria"
- event_code: "ACQFH-2026"
- organization_id: (el UUID generado en paso 1)
- start_date: 2026-03-19
- end_date: 2026-03-21
- venue_name: "Centro de Convenciones, Medellin"
- status: "published"

### Paso 3 — Crear asistente con codigo de acceso hasheado

Se necesita generar el hash bcrypt del codigo `TEST1234` desde un Edge Function (no se puede hacer bcrypt en SQL puro). La estrategia sera:

1. Crear un Edge Function temporal `seed-test-data` que:
   - Crea la organizacion
   - Crea el evento
   - Genera el hash bcrypt de `TEST1234`
   - Inserta el asistente con el hash
   - Retorna el codigo de acceso para confirmar

2. Ejecutar la funcion una vez para poblar los datos
3. Eliminar la funcion despues

### Paso 4 — Probar el login

Navegar a `/ACQFH-2026` e ingresar el codigo `TEST1234`.

## Seccion tecnica

La razon de usar un Edge Function para el seed es que bcrypt no esta disponible como funcion nativa de PostgreSQL en Supabase, y necesitamos que el hash sea compatible con el que usa `verify-access-code`. El Edge Function usara la misma libreria `https://deno.land/x/bcrypt@v0.4.1/mod.ts`.

El Edge Function `seed-test-data` sera temporal y se eliminara despues de usarlo.

