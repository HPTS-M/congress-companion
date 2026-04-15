

## Plan: Ajustes Desktop — Sesión única, Sidebar fijo, y Perfil precargado

### 1. Control de sesión única activa (Bloquear nuevo login)

**Problema:** Actualmente un usuario puede tener múltiples sesiones activas simultáneamente en diferentes dispositivos/navegadores.

**Solución:** Usar una columna `last_session_id` en la tabla `attendees` para rastrear la sesión activa. Al hacer login, verificar si ya hay una sesión activa y bloquear el nuevo intento.

**Cambios:**
- **Migración DB:** Añadir columna `last_session_id text` a la tabla `attendees`.
- **Edge Function `verify-access-code`:** Antes de generar el OTP, verificar si `last_session_id` no es null. Si lo es, retornar error `session_already_active`. Al éxito, guardar el session ID.
- **`src/hooks/useAuth.tsx`:** Al establecer sesión exitosamente, actualizar `last_session_id` en la BD. Al hacer logout, limpiar `last_session_id` a null.
- **`src/pages/attendee/Login.tsx`:** Manejar el error `session_already_active` mostrando mensaje i18n: "Ya tienes una sesión activa en otro dispositivo. Cierra sesión primero."
- **`src/locales/es/common.json` y `en/common.json`:** Añadir claves `auth.sessionAlreadyActive`.

### 2. Sidebar fijo en desktop (≥768px)

**Problema:** En escritorio, el menú hamburguesa solo es accesible al hacer click. Se necesita un sidebar permanente visible.

**Solución:** Crear un sidebar usando el componente `Sidebar` de shadcn/ui que combine los items del BottomNav + HamburgerMenu. En mobile se mantiene el layout actual (header + bottom nav + hamburger). En desktop (md+) se muestra el sidebar fijo y se ocultan el hamburger y el bottom nav.

**Archivos:**
- **Nuevo: `src/components/layout/AttendeeSidebar.tsx`** — Sidebar con todos los items de navegación (home, agenda, checkin, tickets, commercial, polls, contacts, documents, notes, messaging, announcements, ratings, venue-map). Incluye logout en el footer. Usa `Sidebar` de shadcn/ui con `collapsible="icon"`.
- **`src/components/layout/AttendeeLayout.tsx`** — Envolver con `SidebarProvider`. En desktop: mostrar `AttendeeSidebar` + contenido. En mobile: mantener `AppHeader` + `BottomNav` como está.
- **`src/components/layout/AppHeader.tsx`** — Ocultar botón hamburguesa en desktop (`md:hidden`).
- **`src/components/layout/BottomNav.tsx`** — Ocultar en desktop (`md:hidden`).

### 3. Mi Perfil — Precargar email y código de credencial

**Problema:** El perfil ya muestra email y credential_code, pero se necesita confirmar que siempre estén visibles (no filtrados por `.filter(item => item.value)`).

**Revisión del código actual:** `MyProfile.tsx` ya incluye `attendee.email` y `attendee.credential_code` en los `infoItems`. Estos datos vienen del `useAuth()` hook que los carga desde la tabla `attendees`. El `.filter(item => item.value)` podría ocultar items si son null/empty.

**Cambio:**
- **`src/pages/attendee/MyProfile.tsx`:** Asegurar que email y credential_code siempre se muestren (moverlos fuera del filtro o mostrar un placeholder "No asignado" si están vacíos). Estos dos campos ya están en el `AttendeeProfile` type y se cargan en `useAuth`.

---

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `supabase/migrations/` | Migración: añadir `last_session_id` a `attendees` |
| `supabase/functions/verify-access-code/index.ts` | Verificar sesión activa antes de generar OTP |
| `src/hooks/useAuth.tsx` | Actualizar/limpiar `last_session_id` en login/logout |
| `src/pages/attendee/Login.tsx` | Manejar error de sesión activa |
| `src/components/layout/AttendeeSidebar.tsx` | **Nuevo** — Sidebar fijo para desktop |
| `src/components/layout/AttendeeLayout.tsx` | Integrar SidebarProvider + sidebar en desktop |
| `src/components/layout/AppHeader.tsx` | Ocultar hamburguesa en md+ |
| `src/components/layout/BottomNav.tsx` | Ocultar en md+ |
| `src/pages/attendee/MyProfile.tsx` | Garantizar email y credential_code siempre visibles |
| `src/locales/es/common.json` | Nuevas claves i18n |
| `src/locales/en/common.json` | Nuevas claves i18n |

### Orden de implementación
1. Migración DB + Edge Function (sesión única)
2. Hook auth + Login page (sesión única frontend)
3. AttendeeSidebar + AttendeeLayout (sidebar desktop)
4. AppHeader + BottomNav (ocultar en desktop)
5. MyProfile (precargar campos)
6. i18n

