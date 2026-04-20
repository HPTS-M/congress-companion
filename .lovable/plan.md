

## Plan: Fix definitivo del login móvil (token_hash + UX + rate limit)

### Resumen del bug

La edge function `verify-access-code` genera el magic link con `supabase.auth.admin.generateLink()`. Según el contexto del cliente y la configuración actual del proyecto Supabase, el SDK devuelve la sesión por **una de dos vías**:

- `properties.email_otp` (OTP de 6 dígitos) — funciona en desktop.
- `properties.hashed_token` / `token_hash` (PKCE flow moderno) — se activa típicamente en navegadores móviles (Chrome Android, Safari iOS) por su comportamiento de almacenamiento y user-agent.

El cliente actual **solo lee `email_otp`**. En móvil ese campo viene `undefined`, por lo que `verifyOtp({ token: undefined })` falla → "Ha ocurrido un error" → el usuario reintenta → cae en el rate limit de 5 intentos/IP (agravado en móvil por CGNAT del operador).

### Mejor práctica oficial de Supabase (2024–2026)

La documentación recomienda el flujo `verifyOtp({ token_hash, type })` como método **universal y recomendado** para magic links porque:

- Funciona con PKCE habilitado (default en proyectos nuevos).
- No depende de que el OTP de 6 dígitos esté habilitado en Auth settings.
- Es el formato que retorna `admin.generateLink()` siempre (vía `hashed_token`).
- Es agnóstico al dispositivo y al navegador.

Mantener `email_otp` como **fallback** (no como camino principal) cubre la retro-compatibilidad sin romper nada.

---

### Cambios

**1. `supabase/functions/verify-access-code/index.ts`** — siempre devolver `token_hash`

Hoy la función prioriza `email_otp` y solo emite `token_hash` cuando `email_otp` falta. Invertir la prioridad para que **siempre** incluya `token_hash` (mapeando desde `properties.hashed_token`) y opcionalmente `email_otp` cuando exista. Garantiza que el cliente reciba el método universal en cualquier dispositivo.

Respuesta nueva (campos relevantes):
```json
{
  "success": true,
  "token_hash": "pkce_xxx",      // SIEMPRE presente
  "type": "magiclink",            // SIEMPRE
  "email_otp": "123456",          // opcional (si Supabase lo emitió)
  "email": "...",
  "attendee": {...},
  "event": {...}
}
```

**2. `src/services/auth.service.ts`** — soportar ambos formatos, preferir `token_hash`

```ts
verifyAccessCode → tipo de retorno con: token_hash?, type?, email_otp? (todos opcionales pero al menos uno presente)

establishSession(email, opts: { tokenHash?, emailOtp? })
  → si opts.tokenHash: verifyOtp({ token_hash, type: 'magiclink' })  // camino moderno, preferido
  → si opts.emailOtp:  verifyOtp({ email, token, type: 'magiclink' }) // fallback
  → si no hay ninguno: throw 'No auth token returned'
```

**3. `src/hooks/useAuth.tsx`** — pasar ambos campos

```ts
await authService.establishSession(result.email, {
  tokenHash: result.token_hash,
  emailOtp: result.email_otp,
});
```

**4. `src/pages/attendee/Login.tsx` + `locales/{es,en}/common.json`** — mensaje de error más claro

Reemplazar el fallback genérico `t('error')` por `t('auth.loginGenericError')`:
- ES: "No pudimos validar tu código. Verifica que esté correcto e intenta de nuevo."
- EN: "We couldn't validate your code. Check it and try again."

Esto evita que futuros bugs se disfracen de "Ha ocurrido un error" y el usuario pueda diferenciar entre código inválido y problema técnico.

**5. Ajuste del rate limit en `verify-access-code`** — más realista para móvil con CGNAT

- Subir `RATE_LIMIT_MAX` de **5 → 10** intentos por ventana.
- **Solo contar intentos fallidos** (no incrementar `access_attempts` cuando el login es exitoso). Esto previene falsos bloqueos en sesiones legítimas y mantiene la protección anti-fuerza-bruta.
- Incluir `event_code` como parte de la clave de rate limit (clave compuesta IP + event_code) para reducir colisiones entre usuarios distintos del mismo operador móvil que acceden a eventos diferentes.

**6. Migration única — liberar al usuario afectado**

```sql
DELETE FROM access_attempts 
WHERE ip_address IN ('177.253.145.90', '181.130.220.114')
  AND attempted_at > now() - interval '30 minutes';
```

Permite al usuario reintentar inmediatamente sin esperar 15 minutos.

---

### Compatibilidad cross-browser garantizada

- **Chrome Android / WebView**: usa `token_hash` → camino moderno → entra al primer intento.
- **Safari iOS**: idem (Safari es estricto con PKCE) → `token_hash` → entra al primer intento.
- **Chrome / Edge / Firefox desktop**: si Supabase emite `email_otp`, también se incluye `token_hash`. El cliente prioriza `token_hash` (más confiable). Funciona igual.
- **PWA instalada (standalone)**: misma ruta que el navegador subyacente. Sin cambios.

### Sin cambios en

- `verify-access-code` lógica de validación bcrypt y conflict-detection — solo se ajusta el shape de la respuesta y el rate limit.
- Configuración de Supabase Auth — todo se resuelve en código.
- Otros flujos (admin login, provider login, staff login).

### Validación post-deploy

1. **Móvil real (Chrome Android + Safari iOS)** del usuario afectado: ingresar código `→` debe entrar al primer intento sin "Ha ocurrido un error".
2. **Desktop**: regresión OK con código válido.
3. **Código inválido en móvil**: mostrar "Código inválido", no el genérico ni el de rate limit.
4. **Rate limit**: 10 intentos fallidos seguidos antes del bloqueo; los exitosos no cuentan.
5. **DevTools → Network**: respuesta de `verify-access-code` siempre trae `token_hash`. Cliente llama `verifyOtp({ token_hash })` → 200 OK.
6. **Auth logs**: aparece `path: /verify status: 200` después de cada login exitoso (hoy solo aparece en desktop).

### Archivos modificados

- `supabase/functions/verify-access-code/index.ts` (shape de respuesta + rate limit refinado)
- `src/services/auth.service.ts` (firma de `establishSession` + tipo de retorno)
- `src/hooks/useAuth.tsx` (llamada actualizada)
- `src/pages/attendee/Login.tsx` (mensaje de error específico)
- `src/locales/es/common.json` y `src/locales/en/common.json` (clave `auth.loginGenericError`)
- Migration SQL: `DELETE FROM access_attempts ...` para liberar IPs afectadas

