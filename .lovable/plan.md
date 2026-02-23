

# Fix: Infinite Recursion on `attendees` RLS + Event Code Mismatch

## Root Cause Analysis

### ISSUE 1 -- Login appears broken (field clears, nothing happens)

Two separate problems are compounding:

**Problem A: Infinite recursion in `attendees` RLS policy (CRITICAL)**

The migration we just ran added this policy to `attendees`:

```sql
-- "Attendees view event directory"
USING (
  event_id IN (
    SELECT a.event_id FROM attendees a WHERE a.user_id = auth.uid()
  )
)
```

This subquery references the `attendees` table **from within its own RLS policy**. When PostgreSQL evaluates any SELECT on `attendees`, it triggers this policy, which queries `attendees` again, which triggers the policy again -- infinite recursion.

Every call to `loadAttendeeProfile()` in `useAuth.tsx` returns HTTP 500 with `"infinite recursion detected in policy for relation 'attendees'"`. Because the profile never loads, `isAttendee` stays `false`, and the `AttendeeRoute` guard redirects to login.

The same recursion also affects the `contacts` table policies, which subquery `attendees` too:

```sql
-- contacts policies contain:
user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
```

When Postgres evaluates this subquery on `attendees`, it hits the recursive directory policy.

**Problem B: Wrong event code in URL**

The user is on `/TEST1234`, but the only event in the database has `event_code = 'ACQFH-2026'`. The `EventProvider` queries by event_code, gets 0 rows, and shows "Evento no encontrado". The correct URL is `/ACQFH-2026`.

### ISSUE 2 -- Contacts page redirects to login

This is a direct consequence of Issue 1. The `AttendeeRoute` guard checks `isAttendee`, which is `false` because `loadAttendeeProfile()` fails with the infinite recursion error. So every protected route redirects to login.

## Fix Plan

### Step 1: Create SECURITY DEFINER helper functions

These functions bypass RLS when called inside policies, breaking the recursion:

```sql
CREATE OR REPLACE FUNCTION public.get_my_attendee_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.attendees
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_my_event_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT event_id FROM public.attendees
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
$$;
```

### Step 2: Drop and recreate the attendees directory policy

Replace the self-referencing policy with one that uses the helper function:

```sql
DROP POLICY "Attendees view event directory" ON public.attendees;

CREATE POLICY "Attendees view event directory"
ON public.attendees FOR SELECT TO authenticated
USING (
  event_id IN (SELECT get_my_event_ids())
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);
```

### Step 3: Drop and recreate all contacts policies

Replace `SELECT id FROM attendees WHERE ...` subqueries with `get_my_attendee_ids()`:

```sql
DROP POLICY "Authenticated read own contacts" ON public.contacts;
DROP POLICY "Authenticated insert contacts" ON public.contacts;
DROP POLICY "Authenticated update contacts" ON public.contacts;
DROP POLICY "Authenticated delete contacts" ON public.contacts;
DROP POLICY "Attendees manage own contacts" ON public.contacts;

-- Recreate using helper function
CREATE POLICY "Authenticated read own contacts" ...
  USING (user_id IN (SELECT get_my_attendee_ids())
    OR contact_id IN (SELECT get_my_attendee_ids()));

CREATE POLICY "Authenticated insert contacts" ...
  WITH CHECK (user_id IN (SELECT get_my_attendee_ids()));

-- (and similarly for update/delete)
```

### Step 4: No frontend code changes needed

The `useAuth.tsx`, `AttendeeRoute`, `Login.tsx`, and `Contacts.tsx` code is correct. The only problem is the database policies causing 500 errors.

## Files Changed

| File | Change |
|---|---|
| New migration SQL | Create helper functions + recreate 6 RLS policies |

No frontend files need modification.

## After Fix

1. Navigate to `/ACQFH-2026` (the correct event code)
2. Enter the access code to log in
3. The attendee profile will load successfully (no more 500)
4. Navigate to `/ACQFH-2026/contacts` to verify the Contacts module works

