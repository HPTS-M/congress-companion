

## Plan: Resolver error "Session already active" y prevenir recurrencia

### Problema
El attendee tiene un `last_session_id` residual en la base de datos que no fue limpiado (sesión expirada, pestaña cerrada, etc.). La edge function bloquea el login en línea 154 si este campo no es null.

### Solución (2 partes)

**1. Fix inmediato: Limpiar el `last_session_id` estancado**
- Ejecutar migración SQL para limpiar `last_session_id` del attendee afectado.

```sql
UPDATE attendees SET last_session_id = NULL 
WHERE id = 'aa67acd8-84ba-4a90-bfdd-428c396d413f';
```

**2. Fix permanente: Modificar la edge function para no bloquear**
- En `verify-access-code/index.ts`, en lugar de rechazar con 409 cuando `last_session_id` existe, simplemente limpiar la sesión anterior y permitir el nuevo login. Esto es más resiliente porque las sesiones pueden quedar huérfanas por múltiples razones (token expirado, navegador cerrado, localStorage limpiado).

| Archivo | Cambio |
|---|---|
| Edge function `verify-access-code` | Líneas 153-156: Reemplazar el bloqueo `return jsonError(409, 'Session already active')` por un `UPDATE` que limpia `last_session_id` y permite continuar el login. |

### Código del cambio en la edge function

```typescript
// Antes (bloquea):
if (matchedAttendee.last_session_id) {
  return jsonError(409, 'Session already active');
}

// Después (permite, limpia sesión anterior):
if (matchedAttendee.last_session_id) {
  await supabaseAdmin
    .from('attendees')
    .update({ last_session_id: null })
    .eq('id', matchedAttendee.id);
}
```

Esto permite que el último dispositivo que inicie sesión siempre gane, en lugar de bloquear indefinidamente al usuario.

