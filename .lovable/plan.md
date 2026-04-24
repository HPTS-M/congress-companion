## Contexto

Las 3 cosas pedidas (Supabase Auth real, tabla `user_roles` + `has_role()` SECURITY DEFINER, guards de ruta) **ya están implementadas**. Este plan **audita y refuerza** lo existente, en lugar de reescribirlo (lo cual rompería el evento ACQFH-2026 en curso con 83 sesiones activas).

## Estado actual verificado

| Pieza | Ubicación | Estado |
|---|---|---|
| Supabase Auth real | `src/hooks/useAuth.tsx` | ✅ Usa `supabase.auth.onAuthStateChange`, `getSession`, `signInWithPassword`, MFA. Sin mock. |
| Tabla `user_roles` | DB `public.user_roles` | ✅ Con enum `app_role`, `organization_id`, `expires_at`, `is_active`, `assigned_by` |
| `has_role()` SECURITY DEFINER | DB function | ✅ `STABLE`, `search_path=public`, valida `is_active` y `expires_at` |
| RLS en `user_roles` | 7 políticas | ✅ Con `block_anon_access`, `Users can view own roles`, `Admins/Superusers manage` |
| `AdminRoute` guard | `src/components/guards/AdminRoute.tsx` | ✅ Redirect real + chequeo MFA aal2 |
| `AttendeeRoute` guard | `src/components/guards/AttendeeRoute.tsx` | ✅ Redirect real |

## Hallazgos de la auditoría (gaps reales a cerrar)

### 1. Rutas Staff y Provider sin guard centralizado
En `App.tsx` las rutas `/staff/checkin`, `/provider/dashboard`, `/provider/service/:id`, `/provider/change-password` están sueltas — la protección está duplicada *dentro* de cada página (`useEffect` que llama `getProviderSession` y hace `navigate`).

Problemas:
- Hay un flash de UI antes del redirect.
- Lógica repetida en 4 archivos.
- Si alguien añade una nueva página de provider y olvida copiar el `useEffect`, queda pública.

**Fix:** crear `ProviderRoute.tsx` y `StaffRoute.tsx` siguiendo el mismo patrón que `AdminRoute`/`AttendeeRoute`, y envolver las rutas en `App.tsx` mediante elementos padre. Eliminar los `useEffect` redundantes en las páginas.

### 2. `AdminRoute` no exige rol específico por ruta
Hoy `isAdmin` se cumple si el usuario tiene cualquiera de: `superuser | admin | coordinator | field_manager`. Pero algunas rutas admin (ej. `staff`, `config`) deberían restringirse a `admin/superuser`.

**Fix:** extender `AdminRoute` con prop opcional `requiredRoles?: AppRole[]` y aplicarla en rutas sensibles. Sin romper el comportamiento por defecto.

### 3. `useAuth` no expone los roles del usuario
`loadAttendeeProfile` llama `get_user_roles` pero solo guarda el booleano `isAdmin`. Para guards por rol específico hace falta exponer el array.

**Fix:** añadir `roles: AppRole[]` al estado de `AuthContextValue` y persistirlo. Crear helper `hasRole(role)` en el contexto.

### 4. Falta tipo `AppRole` en TypeScript
El enum `app_role` existe en DB pero el frontend usa `string[]`. Riesgo de typos.

**Fix:** importar el tipo desde `src/integrations/supabase/types.ts` (auto-generado) y usarlo en todos los guards/hooks.

### 5. (Opcional) `is_active` y `expires_at` ya están en `has_role` ✅
Verificado: la función actual ya filtra `is_active = true AND (expires_at IS NULL OR expires_at > now())`. No hace falta cambio.

## Plan de implementación

### Paso 1 — Backend (sin migración, ya está bien)
No se requieren cambios en `user_roles` ni en `has_role()`. Solo verificar con `supabase--linter` que no haya warnings nuevos.

### Paso 2 — Tipos compartidos
- Crear `src/types/auth.ts` con:
  - `export type AppRole = Database['public']['Enums']['app_role']`
  - Constante `ADMIN_ROLES: AppRole[] = ['superuser','admin','coordinator','field_manager']`

### Paso 3 — Extender `useAuth`
- Añadir `roles: AppRole[]` al state.
- Guardar el resultado de `get_user_roles` con tipo correcto.
- Exponer helper `hasRole(role: AppRole): boolean` y `hasAnyRole(roles: AppRole[]): boolean`.
- Mantener `isAdmin` como derivado para no romper consumidores actuales.

### Paso 4 — Refinar `AdminRoute`
- Añadir prop opcional `requiredRoles?: AppRole[]`.
- Si se pasa, validar con `hasAnyRole` además de `isAdmin`.
- Sin esa prop, comportamiento idéntico al actual.

### Paso 5 — Crear `ProviderRoute` y `StaffRoute`
- `ProviderRoute.tsx`: lee sesión via `providerPortalService.getProviderSession()`, valida `event_code === eventSlug`, redirige a `/${eventSlug}/provider`. Maneja `password_changed` (redirige a change-password si falta).
- `StaffRoute.tsx`: valida `isAuthenticated`, llama `adminStaffService.getStaffByUserId`, redirige a `/${eventSlug}/staff` si no es staff del evento.
- Ambos muestran skeleton mientras cargan.

### Paso 6 — Aplicar guards en `App.tsx`
Reagrupar rutas con elementos padre que rendericen el guard:

```tsx
<Route path="provider" element={<ProviderRoute />}>
  <Route index element={<ProviderLogin />} />        {/* login pública */}
  <Route path="change-password" element={<ProviderChangePassword />} />
  <Route path="dashboard" element={<ProviderDashboard />} />
  <Route path="service/:serviceId" element={<ProviderServiceAttendees />} />
</Route>
```

(Login pública queda fuera del guard, o el guard la deja pasar.)

### Paso 7 — Limpiar páginas de provider/staff
Eliminar el `useEffect` de auth-check en `Dashboard.tsx`, `ServiceAttendees.tsx`, `ChangePassword.tsx`, `CheckinView.tsx` ahora que el guard se encarga. Mantener solo la carga de datos.

### Paso 8 — Aplicar `requiredRoles` en rutas admin sensibles
- `admin/staff` y `admin/config` → `requiredRoles={['superuser','admin']}` (excluye coordinator/field_manager).
- Resto de rutas admin sigue sin restricción extra.

### Paso 9 — Validación
- `supabase--linter` para confirmar sin warnings nuevos.
- Probar login admin y verificar que `roles` se popula.
- Probar acceso a `/provider/dashboard` sin sesión → redirect.
- Probar acceso a `/admin/config` con coordinator → redirect a dashboard.
- Verificar que los 83 usuarios activos del evento ACQFH-2026 no se vean afectados (no se tocan tablas ni `verify-access-code`).

## Archivos modificados / creados

**Nuevos:**
- `src/types/auth.ts`
- `src/components/guards/ProviderRoute.tsx`
- `src/components/guards/StaffRoute.tsx`

**Modificados:**
- `src/hooks/useAuth.tsx` (añadir `roles` y helpers)
- `src/components/guards/AdminRoute.tsx` (prop `requiredRoles`)
- `src/App.tsx` (reagrupar rutas provider/staff bajo guards)
- `src/pages/provider/Dashboard.tsx` (quitar useEffect de auth)
- `src/pages/provider/ServiceAttendees.tsx` (idem)
- `src/pages/provider/ChangePassword.tsx` (idem)
- `src/pages/staff/CheckinView.tsx` (mantener carga de staffMember, pero quitar redirect manual de auth)

**No se toca:**
- Tabla `user_roles` ni función `has_role()` (ya correctas).
- Edge function `verify-access-code` (login asistente).
- RLS de ninguna tabla.
- Sesión de los 83 usuarios activos.

## Riesgos

- **Bajo:** los cambios son aditivos y compatibles hacia atrás. El comportamiento de `isAdmin`/`isAttendee` actual se preserva.
- **Mitigación:** al desplegar, validar primero en `id-preview-*.lovable.app` con un usuario admin y un asistente del evento ACQFH-2026 antes de que afecte a producción.