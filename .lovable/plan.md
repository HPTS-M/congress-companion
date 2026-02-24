

# Plan: Phase 6 — Admin Panel Foundation

## Current State

- **Admin Login** (`src/pages/admin/Login.tsx`): Already exists with email/password auth, event access verification, and i18n. Looks good, minimal changes needed.
- **AdminRoute guard** (`src/components/guards/AdminRoute.tsx`): Already exists, checks `isAuthenticated` + `isAdmin` from `useAuth`. Also needs `isProfileLoading` check to avoid premature redirects.
- **useAuth**: Already loads admin roles via `get_user_roles` RPC and sets `isAdmin` flag.
- **App.tsx**: Admin login route exists but no admin layout or dashboard routes.
- **i18n**: `admin.json` exists in both ES/EN with login and basic nav keys.
- **No admin layout or dashboard pages exist yet.**

## What Needs to Be Built

### 1. Database: Create Test Admin User
Create the admin user via Supabase Auth and assign roles. This requires:
- Creating a user `admin@congressapp.com` with password `Admin2026!` in Supabase Auth
- Inserting a profile row
- Assigning `admin` role in `user_roles` table for the test event's organization
- Adding to `event_staff` table for event `5efca36a-deef-489b-be85-3dc9d1501ed7`

This will be done via a migration that uses `auth.users` insert (via Edge Function since we can't INSERT into auth.users from migrations) — actually, the best approach is to create the user via the Supabase dashboard or an Edge Function. We'll use a migration to set up `user_roles` and `event_staff` entries after the user is created manually. Alternatively, we can use `supabase.auth.admin.createUser` in an Edge Function.

**Revised approach**: Create an Edge Function `create-admin-user` that creates the auth user and sets up roles + event_staff, then call it once.

### 2. AdminRoute Guard Fix
Update to also check `isProfileLoading` to avoid premature redirect before roles are loaded.

### 3. Admin Layout (`src/components/layout/AdminLayout.tsx`)
- Dark sidebar (240px, `#1A2332`) with:
  - CONGRÉSSAPP logo at top
  - Event name + "Admin" badge
  - 9 navigation items with icons
  - Bottom: "Volver a la app" link + logout button
- Uses shadcn Sidebar component
- Mobile: collapsible hamburger
- Main content area with `<Outlet />`

### 4. Admin Dashboard (`src/pages/admin/Dashboard.tsx`)
- 4 metric cards fetching counts from Supabase:
  - `attendees` count (where event_id matches, deleted_at IS NULL)
  - `attendee_checkins` count (today, joined with event_activities for event_id)
  - `documents` count (event_id)
  - `announcements` count (event_id)
- Recent activity list (placeholder with available data)
- Quick action buttons

### 5. Admin Dashboard Service (`src/services/admin.service.ts`)
- `getEventStats(eventId)` — fetches the 4 counts
- Uses existing `get_event_statistics` RPC or direct queries

### 6. Route Registration in App.tsx
Add admin routes wrapped in `AdminRoute` guard and `AdminLayout`:
```
/:eventSlug/admin/dashboard
```
(Other admin pages will be added in subsequent phases)

### 7. i18n Updates
Extend `admin.json` (ES/EN) with dashboard, nav, and layout keys.

## Technical Details

### File Changes

| File | Action | Description |
|---|---|---|
| `supabase/functions/create-admin-user/index.ts` | Create | Edge Function to create admin user + assign roles |
| `src/components/guards/AdminRoute.tsx` | Modify | Add `isProfileLoading` check |
| `src/components/layout/AdminLayout.tsx` | Create | Sidebar + main content layout |
| `src/pages/admin/Dashboard.tsx` | Create | Dashboard with 4 metric cards + activity |
| `src/services/admin.service.ts` | Create | Admin data fetching service |
| `src/hooks/useAdminDashboard.ts` | Create | React Query hook for dashboard data |
| `src/App.tsx` | Modify | Add admin layout + dashboard routes |
| `src/locales/es/admin.json` | Modify | Add nav, dashboard, layout keys |
| `src/locales/en/admin.json` | Modify | Mirror ES keys |
| `src/lib/i18n.ts` | Verify | Admin namespace already loaded |

### Admin User Creation Flow
1. Deploy Edge Function `create-admin-user`
2. Call it once to create `admin@congressapp.com` with `Admin2026!`
3. The function will:
   - `supabase.auth.admin.createUser({ email, password })`
   - INSERT into `profiles`
   - Get event's `organization_id`
   - INSERT into `user_roles` (role: 'admin', organization_id)
   - INSERT into `event_staff` (event_id, user_id, role: 'admin')

### AdminRoute Guard
```typescript
if (isLoading || isProfileLoading) return <LoadingSpinner />;
if (!isAuthenticated || !isAdmin) return <Navigate to="admin/login" />;
```

### Sidebar Navigation Items
```
Dashboard     — LayoutDashboard icon
Asistentes    — Users icon
Agenda        — Calendar icon
Documentos    — FolderOpen icon
Patrocinadores — Building2 icon
Logística     — Ticket icon
Comunicaciones — Megaphone icon
Check-in Staff — ScanLine icon
Reportes      — BarChart3 icon
```

### Dashboard Metric Queries
Uses the existing `get_event_statistics` RPC which returns `total_attendees`, `confirmed_attendees`, `checked_in_attendees`, `total_activities`, `total_checkins`. For documents and announcements, direct COUNT queries will supplement.

