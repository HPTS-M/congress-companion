

## Diagnosis: All `announcements` RLS policies are RESTRICTIVE — nothing can pass

Looking at the RLS policies on the `announcements` table, **every single policy has `Permissive: No`** (i.e., they are all RESTRICTIVE). This is the root cause.

### How PostgreSQL evaluates RLS

- **PERMISSIVE** policies combine with OR — any one passing grants access
- **RESTRICTIVE** policies combine with AND — all must pass simultaneously

When every policy is RESTRICTIVE, the user must satisfy ALL of them at once. Since `block_anon_access` uses `USING (false)` and is RESTRICTIVE, it creates an impossible AND condition — no authenticated user can ever pass `false AND (anything)`.

This same pattern (per memory `security/rls-composition-pattern`) was already identified as a known issue: "PostgreSQL denies all access if zero permissive policies exist."

### Fix

Drop and recreate the announcement policies so that:
- `block_anon_access` stays **RESTRICTIVE** (blocks anonymous)
- All other policies become **PERMISSIVE** (at least one must match for authenticated users)

```sql
-- Drop existing broken policies
DROP POLICY IF EXISTS "Admins manage org announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated read event announcements" ON announcements;
DROP POLICY IF EXISTS "Superusers manage all announcements" ON announcements;
DROP POLICY IF EXISTS "block_anon_access" ON announcements;

-- Recreate block_anon as RESTRICTIVE
CREATE POLICY "block_anon_access"
ON announcements FOR SELECT TO anon
USING (false);

-- Recreate others as PERMISSIVE
CREATE POLICY "Admins manage org announcements"
ON announcements FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = announcements.event_id
    AND events.organization_id = get_user_organization(auth.uid())
  )
  AND has_org_role(auth.uid(), 'admin', (
    SELECT events.organization_id FROM events WHERE events.id = announcements.event_id
  ))
);

CREATE POLICY "Authenticated read event announcements"
ON announcements FOR SELECT TO authenticated
USING (
  event_id IN (SELECT event_id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Superusers manage all announcements"
ON announcements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'));
```

### Files changed

- **One database migration** — fixes the RLS policies from RESTRICTIVE to PERMISSIVE
- **No frontend code changes needed** — the service/hook logic is already correct

### Expected result after fix

- Dashboard "Anuncios enviados" card: **7**
- Communications "Total anuncios enviados": **7**
- Communications "Asistentes alcanzados": **6**
- Each announcement row shows its stored `reach_count`

