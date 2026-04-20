

## Crear asistente "Daniel Sanchez" en ACQFH-2026 con código `3ZSTDB6X`

### Acción

Insertar fila en `attendees` para Daniel Sanchez vinculada al evento ACQFH-2026, usando el email `estudiomapeoloinc@gmail.com`.

### SQL a ejecutar

```sql
INSERT INTO attendees (
  event_id,
  full_name,
  email,
  access_code_hash,
  registration_status,
  invitation_sent_at
)
VALUES (
  (SELECT id FROM events WHERE event_code = 'ACQFH-2026'),
  'Daniel Sanchez',
  'estudiomapeoloinc@gmail.com',
  '<bcrypt_hash_of_3ZSTDB6X_cost_10>',
  'confirmed',
  now()
);
```

### Detalles técnicos

- **`credential_code`**: lo genera automáticamente el trigger del proyecto (`{EVENT_CODE}-{sequence}`).
- **`access_code_hash`**: bcrypt cost 10 de `3ZSTDB6X` (mismo parámetro que `send-invitation-email` y `regenerate-access-code`).
- **`user_id`**: queda `NULL`. La Edge Function `verify-access-code` lo crea/vincula en el primer login (busca o crea en `auth.users` por email; si ya existe el `profiles` con ese email, reutiliza el `user_id`).
- **`registration_status = 'confirmed'`**: evita el flujo de pendiente.
- **`last_session_id`**: queda `NULL` (no hay bloqueo de "sesión activa").
- **Limpiar `access_attempts`** para tu IP para evitar el rate-limit 429:
  ```sql
  DELETE FROM access_attempts WHERE event_code = 'ACQFH-2026';
  ```

### Resultado esperado

Podrás ir a `https://congress-connect-app.lovable.app/ACQFH-2026`, ingresar `3ZSTDB6X` y entrar como Daniel Sanchez.

