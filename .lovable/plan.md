

## Fix: Duplicate event code in invitation email link

### Problem
The invitation email generates a link like:
`https://congress-companion.vercel.app/ACQFH-2026//ACQFH-2026`

This happens because the `APP_URL` Supabase secret likely already contains the event path (e.g. `https://congress-companion.vercel.app/ACQFH-2026/`), and then line 62 of the Edge Function appends `/${eventCode}` again.

### Solution

Two changes to make the link robust regardless of how `APP_URL` is configured:

#### 1. `supabase/functions/send-invitation-email/index.ts`
- On line 160, strip any trailing slash from `appUrl` with `.replace(/\/+$/, '')`
- On line 62 (the email link), keep `${appUrl}/${eventCode}` as-is — this is correct when `APP_URL` is just the domain

#### 2. Verify/fix the `APP_URL` Supabase secret
- Confirm that `APP_URL` is set to just `https://congress-companion.vercel.app` (no trailing path or slash)
- If it currently includes `/ACQFH-2026/`, update it to remove the event-specific path — `APP_URL` should be the base domain only since the function already appends the event code

### Files changed
1. **Edit**: `supabase/functions/send-invitation-email/index.ts` — add trailing-slash strip as a safety measure
2. **Redeploy**: `send-invitation-email` Edge Function

