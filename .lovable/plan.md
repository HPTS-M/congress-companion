

## Plan — 2FA TOTP configurable para administradores

### Resumen

Implemento 2FA TOTP (Google Authenticator y compatibles) para administradores **con un toggle de activación/desactivación** en cada cuenta admin. Cada admin decide individualmente si activa su 2FA desde una nueva sección "Seguridad" en su perfil. No es obligatorio globalmente — es opt-in por usuario.

### Cómo será la experiencia

#### Admin activa 2FA (opt-in)
1. Admin entra a "Mi Perfil → Seguridad" (nueva sección).
2. Ve un toggle "Autenticación de dos factores" en OFF.
3. Al activar el toggle → modal con QR code para escanear con Google Authenticator + código manual de respaldo.
4. Introduce el código de 6 dígitos de la app → 2FA queda activo.
5. Toast confirma activación.

#### Login con 2FA activo
1. Admin entra email + password.
2. Sistema detecta MFA activo → redirige a `/admin/2fa/verify`.
3. Introduce código de 6 dígitos → entra al dashboard (sesión `aal2`).

#### Admin desactiva 2FA
1. En "Mi Perfil → Seguridad" toggle ON → click → confirma con código actual.
2. 2FA queda desactivado, próximos logins son normales.

#### Recuperación (pérdida de dispositivo)
- Superuser puede ejecutar acción "Resetear 2FA" desde el panel de gestión de admins.
- Internamente llama a edge function `reset-admin-mfa` que elimina el factor MFA.
- El admin afectado entra en su próximo login sin 2FA y puede reconfigurarlo.

### Arquitectura técnica

**API nativa de Supabase** — sin librerías externas, sin custom crypto:
- `supabase.auth.mfa.enroll({ factorType: 'totp' })` → devuelve QR + secret
- `supabase.auth.mfa.challenge({ factorId })` + `verify({ factorId, challengeId, code })`
- `supabase.auth.mfa.listFactors()` → detecta si tiene MFA activo
- `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` → detecta `aal1` vs `aal2`
- `supabase.auth.mfa.unenroll({ factorId })` → desactiva

**Sin migración de BD** — Supabase guarda factores en `auth.mfa_factors` (gestionado nativamente).

**Configuración previa requerida (1 click manual del usuario):**
Activar TOTP en Supabase Dashboard → Authentication → Providers → Multi-Factor Authentication. Le pasaré el link directo.

### Cambios en el código

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/services/auth.service.ts` | Modificar | Añadir bloque `mfa` con wrappers de las APIs de Supabase |
| `src/hooks/useAuth.tsx` | Modificar | Estado adicional: `mfaEnrolled`, `mfaLevel`, `mfaRequired` |
| `src/components/guards/AdminRoute.tsx` | Modificar | Si `mfaEnrolled && mfaLevel === 'aal1'` → redirige a `/admin/2fa/verify` |
| `src/pages/admin/MfaVerify.tsx` | Crear | Pantalla de verificación post-login (input OTP 6 dígitos) |
| `src/components/admin/profile/SecuritySettingsCard.tsx` | Crear | Card en perfil admin con toggle 2FA + modal de setup |
| `src/components/admin/profile/MfaSetupModal.tsx` | Crear | Modal con QR + verificación de código para enrolar |
| `src/components/admin/profile/MfaDisableModal.tsx` | Crear | Modal para desactivar (requiere código actual) |
| `src/pages/admin/Profile.tsx` | Crear/Modificar | Página de perfil admin que incluye `SecuritySettingsCard` |
| `src/components/admin/staff/ResetMfaButton.tsx` | Crear | Botón en gestión de staff (solo superuser) para reset MFA de otro admin |
| `supabase/functions/reset-admin-mfa/index.ts` | Crear | Edge function que valida superuser y elimina factor MFA del target |
| `src/App.tsx` | Modificar | Añadir rutas `/admin/2fa/verify` y `/admin/profile` |
| `src/locales/es/admin.json` | Modificar | ~20 claves nuevas para sección MFA |
| `src/locales/en/admin.json` | Modificar | Mismas claves traducidas |

### Configurabilidad — confirmación

El "configurable" se implementa así:
- **Por usuario**: cada admin decide activar/desactivar su propio 2FA desde su perfil. No hay enforcement obligatorio.
- **Recuperación administrativa**: superusers pueden resetear el MFA de otro admin si pierde acceso.
- **Compatibilidad con apps**: Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden, Apple Passwords (todas las compatibles con TOTP estándar).

### Lo que NO se toca

- Login de asistentes (código de acceso) — sin cambios.
- Portales provider/staff — sin cambios.
- RLS policies / schema BD — sin migración.
- Componentes UI existentes — `input-otp.tsx` ya está disponible para el código de 6 dígitos.

### Pasos de verificación post-implementación

1. Admin entra a perfil → activa 2FA → escanea QR → introduce código → toast verde.
2. Logout y login → redirige a `/admin/2fa/verify` → introduce código → entra al dashboard.
3. Admin desactiva 2FA → próximo login es directo (sin 2FA).
4. Superuser resetea 2FA de otro admin → ese admin entra sin 2FA en su próximo login.

### Esfuerzo

~13 archivos, ~500 líneas. Sin nuevas dependencias npm. Sin migración de BD. ~40 minutos de implementación.

### Acción manual requerida antes de codificar

Activar TOTP en Supabase Dashboard. Te pasaré el link directo después de aprobar el plan.

