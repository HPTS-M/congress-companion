## Objetivo

Eliminar la duplicación del bloque `useEffect → getProviderSession → validar event_code → validar password_changed → setSession` que actualmente se repite en `Dashboard.tsx` y `ServiceAttendees.tsx`, y centralizarlo en un hook reutilizable `useProviderSession`.

## Estado actual (duplicación detectada)

| Archivo | Verifica sesión | Valida event_code | Valida password_changed | Redirige |
|---|---|---|---|---|
| `pages/provider/Dashboard.tsx` | ✓ | ✓ | ✓ | `/provider` y `/provider/change-password` |
| `pages/provider/ServiceAttendees.tsx` | ✓ | ✓ | ✗ (debería) | `/provider` |
| `pages/provider/ChangePassword.tsx` | ✗ (usa supabase.auth directo) | — | — | — |
| `pages/provider/Login.tsx` | redirige si ya hay sesión | ✓ | ✓ | — |

`ServiceAttendees` es vulnerable: un provider con `password_changed = false` puede acceder a la lista de asistentes sin pasar por el cambio de contraseña.

## Plan de implementación

### 1. Crear `src/hooks/useProviderSession.ts`

Hook que encapsula la lógica común:

- Lee el `eventSlug` desde `useParams`.
- Llama a `providerPortalService.getProviderSession()`.
- Valida que la sesión exista y que `event_code === eventSlug`. Si falla → redirige a `/{eventSlug}/provider`.
- Si `requirePasswordChanged` está activo (default `true`) y `session.password_changed === false` → redirige a `/{eventSlug}/provider/change-password`.
- Expone un helper `logout()` que llama a `providerPortalService.logout()` y redirige a `/{eventSlug}/provider`.
- Devuelve: `{ session, isLoading, logout }`.

Firma:

```ts
interface UseProviderSessionOptions {
  requirePasswordChanged?: boolean; // default true
}
interface UseProviderSessionReturn {
  session: ProviderSession | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}
```

### 2. Refactorizar `pages/provider/Dashboard.tsx`

- Eliminar el `useState<ProviderSession | null>`, el `useState(loading)` y el `useEffect` de carga de sesión.
- Reemplazar por: `const { session, isLoading: sessionLoading, logout } = useProviderSession();`
- `handleLogout` usa el `logout` del hook.
- Mantener la `useQuery` de servicios condicionada a `!!session?.provider_id`.

### 3. Refactorizar `pages/provider/ServiceAttendees.tsx`

- Mismo reemplazo del `useEffect` de sesión por `useProviderSession()`.
- Esto añade automáticamente la validación `password_changed` que faltaba.
- Manejar el estado `isLoading` de la sesión (mostrar skeleton en vez de `return null`).

### 4. Dejar intactos

- `Login.tsx`: su lógica es distinta (redirigir si YA hay sesión, no proteger una ruta). No se toca.
- `ChangePassword.tsx`: necesita acceso a la sesión SIN validar `password_changed` (justamente se está cambiando). Opcionalmente puede usar `useProviderSession({ requirePasswordChanged: false })` para validar `event_code`, pero hoy no valida nada — lo dejamos fuera del scope de esta iteración salvo que se quiera incluir.

## Archivos a crear / modificar

- **Crear**: `src/hooks/useProviderSession.ts`
- **Modificar**: `src/pages/provider/Dashboard.tsx`
- **Modificar**: `src/pages/provider/ServiceAttendees.tsx`

## Beneficios

- Una sola fuente de verdad para la verificación de sesión del provider.
- Cierre del gap de seguridad en `ServiceAttendees` (validación `password_changed`).
- Menos código duplicado y más fácil de mantener al añadir nuevas páginas `/provider/*`.
- `logout()` reutilizable.
