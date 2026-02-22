

# Apply: Add authenticated SELECT policy for events

## Single migration

Create `supabase/migrations/20260222210000_add_authenticated_events_policy.sql`:

```sql
CREATE POLICY "Authenticated users can view published events"
ON public.events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (status = 'published' AND deleted_at IS NULL);
```

## Verification steps

1. Navigate to `/ACQFH-2026` -- confirm event loads on login screen
2. Enter code `TEST1234` -- confirm authentication and redirect to `/ACQFH-2026/home`
3. Verify home screen shows: attendee name, package fallback, QR code, event info with 500 attendees
4. Take screenshot of final state

No frontend code changes needed.

