

## Plan: Transactional Email via Resend Edge Function

The `RESEND_API_KEY` secret already exists in Supabase. We'll create an Edge Function that calls the Resend API to send transactional emails.

### Step 1 — Create Edge Function `send-email`

Create `supabase/functions/send-email/index.ts`:
- Accept POST with `{ to, subject, html, from_name? }`
- Authenticate caller (admin/superuser role check)
- Call Resend API: `POST https://api.resend.com/emails`
- Use `RESEND_API_KEY` from `Deno.env`
- Default `from`: `"CONGRÉSSAPP <noreply@{your-domain}>"`
- Return success/error JSON

### Step 2 — Add to `supabase/config.toml`

```toml
[functions.send-email]
verify_jwt = false
```

### Step 3 — Create frontend service

Create `src/services/email.service.ts` with helper:
- `sendEmail(to, subject, html, fromName?)` → calls edge function via `supabase.functions.invoke('send-email', ...)`

### Technical Details

- The Edge Function validates the caller is an admin before sending
- Resend API endpoint: `https://api.resend.com/emails`
- Headers: `Authorization: Bearer ${RESEND_API_KEY}`, `Content-Type: application/json`
- The `from` address must use a domain verified in your Resend account

### Before proceeding

You'll need to confirm the **sender email address/domain** verified in your Resend account (e.g., `noreply@yourdomain.com`). Resend requires the `from` address to use a verified domain.

