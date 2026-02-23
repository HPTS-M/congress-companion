

# Fix: GRANT SELECT Missing on `attendees` Table

## Root Cause

The `attendees` table has table-level permissions for `authenticated` role set to INSERT (`a`), UPDATE (`w`), DELETE (`d`) -- but **SELECT (`r`) is missing**. Without this GRANT, PostgreSQL returns error 42501 ("permission denied for table attendees") before RLS policies are even evaluated.

Current ACL: `authenticated=awd/postgres` (no `r`)
Required ACL: `authenticated=arwd/postgres` (with `r`)

The RLS policies we fixed earlier are correct and PERMISSIVE, but they are irrelevant until the base table GRANT is in place.

## Solution

A single migration to grant SELECT permission on the `attendees` table to both `authenticated` and `anon` roles.

## Files to Modify

| File | Change |
|---|---|
| New migration SQL | `GRANT SELECT ON public.attendees TO authenticated, anon;` |

## Technical Details

```sql
-- Grant SELECT permission that is currently missing
GRANT SELECT ON public.attendees TO authenticated;
GRANT SELECT ON public.attendees TO anon;
```

- `anon` needs SELECT so the `block_anon_access` RLS policy can evaluate (otherwise it would get a 403 instead of the RLS-denied empty result).
- `authenticated` needs SELECT so the PERMISSIVE RLS policies can filter and return rows.
- No other tables appear affected (the profile query and contacts query both work with 200 status).

No frontend code changes needed.
