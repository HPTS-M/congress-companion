

## Plan: Restricción de sesión única con opción "Cerrar todas las sesiones"

### Contexto
Actualmente la edge function `verify-access-code` limpia automáticamente cualquier sesión previa y permite el login del nuevo dispositivo (cambio reciente). El usuario quiere revertir parcialmente: bloquear el login si hay sesión activa, pero ofrecer un botón visible que fuerce el cierre de la sesión anterior y permita continuar.

### Comportamiento deseado

```text
1. Usuario ingresa código de acceso
2. Edge function detecta last_session_id activo en otro dispositivo
3. Retorna error 409 "Session already active" (NO limpia automáticamente)
4. Frontend detecta el 409 → muestra Alert con badge:
   ⚠️ "Ya tienes una sesión activa en otro dispositivo"
   [Botón: Cerrar todas las sesiones e iniciar aquí]
5. Usuario hace click en el botón
6. Frontend re-llama edge function con flag force_login=true
7. Edge function limpia last_session_id y permite login
8. Usuario entra al evento
```

### Cambios

| Archivo | Cambio |
|---|---|
| `supabase/functions/verify-access-code/index.ts` | Restaurar bloqueo 409 cuando existe `last_session_id`. Aceptar parámetro opcional `force_login: boolean`. Si `force_login=true`, limpiar sesión y continuar. Schema Zod actualizado. |
| `src/services/auth.service.ts` | `verifyAccessCode` acepta tercer parámetro `forceLogin: boolean = false` y lo envía al body. |
| `src/hooks/useAuth.tsx` | `loginWithCode` acepta tercer parámetro `forceLogin` y lo pasa al service. |
| `src/pages/attendee/Login.tsx` | Agregar estado `sessionConflict: boolean`. Detectar error "Session already active" → mostrar `Alert` destructivo con icono y botón "Cerrar todas las sesiones e iniciar aquí". El botón re-ejecuta `loginWithCode(..., true)`. |
| `src/locales/es/common.json` y `src/locales/en/common.json` | Agregar claves: `auth.sessionConflictTitle`, `auth.sessionConflictMessage`, `auth.forceLoginButton`, `auth.forcingLogin`. |

### UI del conflicto (en Login.tsx)

```text
┌─────────────────────────────────────────┐
│ ⚠️  Sesión activa en otro dispositivo  │
│                                         │
│ Ya tienes una sesión iniciada. Por      │
│ seguridad solo se permite una sesión    │
│ activa a la vez.                        │
│                                         │
│ [Cerrar todas las sesiones e iniciar]  │
└─────────────────────────────────────────┘
```

Usa `<Alert variant="destructive">` de shadcn con `<AlertCircle>` de lucide.

### Lógica edge function (snippet)

```typescript
// Schema
const requestSchema = z.object({
  access_code: z.string()...,
  event_code: z.string()...,
  force_login: z.boolean().optional().default(false),
});

// En el flow, donde antes limpiaba siempre:
if (matchedAttendee.last_session_id) {
  if (!force_login) {
    return jsonError(409, 'Session already active');
  }
  // force_login=true → limpiar y continuar
  await supabaseAdmin
    .from('attendees')
    .update({ last_session_id: null })
    .eq('id', matchedAttendee.id);
}
```

### Notas
- Mantiene seguridad: una sesión por usuario en todo momento.
- El usuario tiene control explícito para cerrar la sesión anterior.
- No se rompe el rate limiting actual (cada intento sigue contando).
- i18n completo para ES/EN.

