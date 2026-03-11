

## Plan: Update create-provider-user Edge Function to use Resend

Replace the entire `supabase/functions/create-provider-user/index.ts` with the user-provided version that:

1. Adds a `sendInviteEmail` helper that sends branded HTML emails via Resend API
2. Uses `generateLink` instead of `inviteUserByEmail` to get the action link without relying on Supabase SMTP
3. Sends the invite/magic link email through Resend using the existing `RESEND_API_KEY` secret
4. Handles all three flows (invite, resend, reinvite) with Resend email delivery

**File changed:** `supabase/functions/create-provider-user/index.ts` — full replacement

No database changes needed. The `RESEND_API_KEY` secret is already configured.

