

## Plan — Ejecución directa del borrado de asistentes para ACQFH-2026

### Qué voy a hacer

En lugar de usar el botón de UI, ejecuto la purga directamente contra la base de datos como una acción one-shot. Uso la edge function `purge-event-attendees` que ya está desplegada (creada en el paso anterior) llamándola con `confirm: true` para que haga todo el trabajo de borrado en orden correcto.

### Por qué usar la edge function ya existente y no SQL directo

1. **Borrado de `auth.users`**: SQL directo no puede borrar usuarios de `auth.users` de forma limpia (requiere el admin API de Supabase con `service_role_key`). La edge function ya tiene esa lógica.
2. **Orden de FKs garantizado**: la edge function ya implementa el orden correcto (chat_attachments → chat_messages → chat_participants → chat_conversations → poll_responses → ... → service_tickets → attendee_services → attendees).
3. **Reporte de conteos**: devuelve un JSON con cuántas filas se borraron por tabla y qué queda intacto.
4. **Auditable**: queda registro en logs de la edge function.

### Pasos exactos de ejecución

#### Paso 1 — Dry-run (verificación previa)
Llamo a la edge function con `confirm: false` para ver el conteo exacto de lo que se borrará. Esto es un seguro: si los números son inesperados (ej: muestra 0 attendees o muestra 10000), abortamos.

```
POST /functions/v1/purge-event-attendees
Body: {
  "event_id": "5efca36a-deef-489b-be85-3dc9d1501ed7",
  "confirm": false,
  "delete_auth_users": true
}
```

Te muestro el JSON de respuesta con todos los conteos.

#### Paso 2 — Ejecución real
Si los conteos son los esperados, llamo de nuevo con `confirm: true`:

```
POST /functions/v1/purge-event-attendees
Body: {
  "event_id": "5efca36a-deef-489b-be85-3dc9d1501ed7",
  "confirm": true,
  "delete_auth_users": true
}
```

La edge function:
1. Borra todos los datos de las tablas dependientes en orden.
2. Borra los `attendees`.
3. Borra los `auth.users` correspondientes vía `supabase.auth.admin.deleteUser()`.
4. Devuelve resumen final con conteos por tabla borrada y conteos de configuración remanente (agenda, sponsors, polls, etc.) para confirmar que el evento sigue intacto.

#### Paso 3 — Verificación SQL post-borrado
Ejecuto consultas SQL directas (read-only) para confirmar que:
- `attendees` del evento → 0 filas.
- `attendee_services` del evento → 0 filas.
- `chat_messages` del evento → 0 filas.
- `event_activities` (agenda) del evento → cuenta intacta.
- `sponsors` del evento → cuenta intacta.
- `service_catalog` del evento → cuenta intacta.

Te muestro la salida de cada verificación.

### Autenticación de la llamada

La edge function valida que el caller tenga rol `superuser`. Como tú estás logueado como superuser en la sesión activa del navegador, la llamada usa tu JWT actual (mecanismo automático de la herramienta `curl_edge_functions` de Lovable).

### Salvaguardas

- Si el conteo del dry-run muestra cifras inesperadas, paro y te pregunto antes de ejecutar.
- La edge function ya está desplegada y testeada en su lógica (creada en el turno anterior con tu aprobación).
- Operación irreversible salvo Point-in-Time Recovery de Supabase.

### Lo que NO se toca

Confirmado por tercera vez para evitar sorpresas:
- Evento `ACQFH-2026` permanece publicado.
- Agenda completa (`event_activities`).
- Sponsors y `service_catalog`.
- Polls (preguntas, no respuestas).
- Documentos académicos.
- Staff, providers, admins.
- Organización.

### Archivos modificados

**Ninguno.** Solo ejecución de la edge function ya existente + lecturas SQL de verificación. No hay código nuevo.

### Resultado entregado

Al terminar, te mostraré:
1. JSON del dry-run (conteo previo).
2. JSON de la ejecución real (conteo borrado + configuración remanente).
3. Tabla de verificación SQL post-borrado confirmando que asistentes = 0 y configuración = intacta.

