

# Fix Remaining Security Issues

## 1. service_tickets — Already Has RLS (No Migration Needed)

The `service_tickets` table already has complete RLS policies from a previous migration:
- `block_anon_access` (RESTRICTIVE, anon, false)
- `Attendees can view own tickets` (SELECT via attendee_services JOIN attendees)
- `Authenticated read own service tickets` (SELECT, same pattern)
- `Event staff can manage tickets` (ALL, coordinator/field_manager with event_staff check)
- `Superusers can manage all tickets` (ALL)

The user's proposed SQL references columns that don't exist (`attendee_id`, `service_id`). The actual column is `attendee_service_id`, and existing policies already handle this correctly via JOINs. **No migration needed.**

## 2. .env — Add to .gitignore

Add `.env` and `.env.*` (except `.env.example`) to `.gitignore` to prevent secrets from being committed.

Also create `.env.example` with placeholder values for documentation.

## 3. RPC Functions — Frontend Usage Report

Functions called from the frontend code:
- `get_user_roles(_user_id)` — used in `useAuth.tsx` and `auth.service.ts` for role checking
- `is_event_staff(_user_id, _event_id)` — used in `auth.service.ts` to verify admin event access

Both functions exist in the database as `SECURITY DEFINER` functions with `search_path = public`, which is correct.

## 4. Post-Fix Security Scan

Run security scan after applying changes to confirm 0 errors.

---

### Technical Changes

| File | Change |
|---|---|
| `.gitignore` | Add `.env`, `.env.local`, `.env.*.local` |
| `.env.example` (new) | Create with placeholder values for `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| No migration | `service_tickets` already fully protected |

