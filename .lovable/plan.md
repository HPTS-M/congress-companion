

# Fix: Three Critical Errors Blocking Login Flow

## Error Analysis

### ERROR 1 -- `attendees` SELECT returns 500 (MOST CRITICAL)
**Not a missing column issue.** The actual error from the response body is:
```
"infinite recursion detected in policy for relation \"attendees\""
```

**Root cause:** The RLS policy **"Attendees view event directory"** contains a self-referential subquery:
```sql
event_id IN (SELECT a.event_id FROM attendees a WHERE a.user_id = auth.uid())
```
When Postgres evaluates a SELECT on `attendees`, it checks this policy, which itself SELECTs from `attendees`, which triggers the policy check again -- infinite loop.

**Fix:** Replace the inline subquery with the existing `get_my_event_ids()` SECURITY DEFINER function (which bypasses RLS):
```sql
DROP POLICY "Attendees view event directory" ON attendees;

CREATE POLICY "Attendees view event directory"
ON attendees FOR SELECT TO authenticated
USING (
  event_id IN (SELECT get_my_event_ids())
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);
```

### ERROR 2 -- `verify-access-code` returns 401
The bcrypt hash stored for "Usuario de Prueba" no longer matches TEST1234 (likely re-hashed with a different algorithm or value during a previous migration).

**Fix:** Regenerate the hash using a SQL update (via insert tool, not migration):
```sql
UPDATE attendees
SET access_code_hash = extensions.crypt('TEST1234', extensions.gen_salt('bf', 10))
WHERE id = 'fb9cb992-242e-41d2-98f8-cc28bf70edce';
```

### ERROR 3 -- `verify-access-code` returns 429
22 rate-limit entries exist in `access_attempts`. The 15-minute window blocks further attempts.

**Fix:** Clear old attempts (via insert tool):
```sql
DELETE FROM access_attempts;
```

### ERROR 4 -- Redirect loop (from previous investigation)
Even after fixing errors 1-3, the login-to-home redirect will loop because `AttendeeRoute` checks `isAttendee` before `loadAttendeeProfile` completes.

**Fix:** Add `isProfileLoading` state to `useAuth.tsx` and update `AttendeeRoute.tsx` to wait for it.

## Execution Order

### Step 1: Database fixes (no migrations needed -- data operations only)
1. Fix RLS policy on `attendees` (this IS a schema change, requires migration)
2. Rehash TEST1234 for test attendee (data update)
3. Clear rate limit table (data update)

### Step 2: Code fixes
1. `src/hooks/useAuth.tsx` -- Add `isProfileLoading` to AuthState; set true before `loadAttendeeProfile`, false after (in finally block)
2. `src/components/guards/AttendeeRoute.tsx` -- Check `isProfileLoading` alongside `isLoading` before redirecting

## Files to Modify

| File | Change Type | Description |
|---|---|---|
| Database migration | Schema | Replace self-referential RLS policy on `attendees` with `get_my_event_ids()` |
| Database (data) | Data | Rehash TEST1234, clear access_attempts |
| `src/hooks/useAuth.tsx` | Code | Add `isProfileLoading` state to prevent premature redirect |
| `src/components/guards/AttendeeRoute.tsx` | Code | Wait for profile loading before evaluating redirect |

## Technical Details

### `useAuth.tsx` changes
```typescript
// Add to AuthState interface
isProfileLoading: boolean;

// Initial state
isProfileLoading: true, // Start true to prevent flash redirect

// In loadAttendeeProfile
const loadAttendeeProfile = async (userId: string) => {
  setState(prev => ({ ...prev, isProfileLoading: true }));
  try {
    // ... existing fetch logic ...
  } finally {
    setState(prev => ({ ...prev, isProfileLoading: false }));
  }
};

// In getSession callback, when no user:
setState(prev => ({
  ...prev,
  isProfileLoading: false, // No user = no profile to load
}));
```

### `AttendeeRoute.tsx` changes
```typescript
const { isAuthenticated, isAttendee, isLoading, isProfileLoading } = useAuth();

if (isLoading || isProfileLoading) {
  return <LoadingSkeleton />;
}

if (!isAuthenticated || !isAttendee) {
  return <Navigate to={`/${eventSlug}`} replace />;
}
```

