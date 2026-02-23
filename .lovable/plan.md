

# Fix: Attendee Directory Returns Empty Due to All-RESTRICTIVE RLS Policies

## Root Cause

All SELECT policies on the `attendees` table are set to **RESTRICTIVE** (non-permissive). In PostgreSQL RLS:
- **PERMISSIVE** policies are OR'd together (any one passing grants access)
- **RESTRICTIVE** policies are AND'd together (all must pass, but only to further limit what PERMISSIVE policies allow)
- If there are **zero PERMISSIVE** policies, access is **always denied** regardless of RESTRICTIVE policies

Current state: 5 RESTRICTIVE SELECT policies, 0 PERMISSIVE. Result: every query returns 0 rows.

## Data Verification

The database has 6 attendees (Maria Gonzalez, Carlos Restrepo, Ana Martinez, Juan Perez, Laura Cano, Usuario de Prueba) -- all confirmed, same event. The data is there; RLS is blocking it.

## Solution

Drop the three RESTRICTIVE SELECT policies and recreate them as PERMISSIVE:

1. **"Attendees can view own record"** -- PERMISSIVE, `user_id = auth.uid()`
2. **"Attendees view event directory"** -- PERMISSIVE, `event_id IN (SELECT get_my_event_ids()) AND deleted_at IS NULL AND registration_status = 'confirmed'`
3. **"Authenticated read own attendee record"** -- DROP (duplicate of #1, not needed)

Also keep the existing admin/staff/superuser policies as RESTRICTIVE (they grant elevated access through their own patterns).

## Files to Modify

| File | Change |
|---|---|
| New migration SQL | Drop 3 RESTRICTIVE SELECT policies, recreate 2 as PERMISSIVE |

## Technical Details

### Migration SQL

```sql
-- Drop all RESTRICTIVE SELECT policies for authenticated users
DROP POLICY IF EXISTS "Attendees can view own record" ON attendees;
DROP POLICY IF EXISTS "Attendees view event directory" ON attendees;
DROP POLICY IF EXISTS "Authenticated read own attendee record" ON attendees;

-- Recreate as PERMISSIVE (default) so they OR together
CREATE POLICY "Attendees can view own record"
ON attendees FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Attendees view event directory"
ON attendees FOR SELECT TO authenticated
USING (
  event_id IN (SELECT get_my_event_ids())
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);
```

This gives authenticated attendees access to:
- Their own record (regardless of status) -- for profile loading
- All confirmed, non-deleted attendees in the same event -- for the directory

The `block_anon_access` RESTRICTIVE policy remains unchanged (correctly blocks anonymous access). Admin/staff/superuser policies also remain unchanged.

No frontend code changes needed -- the service and component code are correct.

