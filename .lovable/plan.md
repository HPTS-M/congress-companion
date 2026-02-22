

# Plan: Corregir RLS de eventos para permitir login

## Problema

La politica `block_anon_access` en la tabla `events` bloquea toda lectura para usuarios anonimos, impidiendo que la pantalla de login cargue los datos del evento.

## Cambio requerido

### Migracion SQL

Ejecutar una migracion que:

1. **Elimine** la politica `block_anon_access` de la tabla `events`
2. **Cree** una nueva politica permisiva para el rol `anon`:

```text
Policy: "Anon can view published events"
Table: events
Command: SELECT
Role: anon
Condition: status = 'published' AND deleted_at IS NULL
```

### Verificacion post-migracion

1. Navegar a `/ACQFH-2026` y confirmar que el evento carga correctamente en la pantalla de login
2. Ingresar el codigo `TEST1234` y verificar que autentica y redirige a `/ACQFH-2026/home`
3. Confirmar que la tabla `attendees` sigue protegida (su politica `block_anon_access` no se toca)

## Seguridad

- Solo se modifica la tabla `events` -- todas las demas tablas mantienen sus politicas restrictivas
- Solo eventos con `status = 'published'` y no eliminados son visibles para anonimos
- La tabla `events` no contiene datos sensibles (los hashes de acceso estan en `attendees`)

