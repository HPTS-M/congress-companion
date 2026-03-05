

## Issue Confirmed

The event lookup in `src/hooks/useEvent.ts` line 25 uses `.eq('event_code', eventSlug)` — a case-sensitive match. The database stores `ACQFH-2026` but the URL provides `acqfh-2026`.

## Plan

**Single file change — `src/hooks/useEvent.ts` line 25:**

Replace:
```typescript
.eq('event_code', eventSlug)
```
With:
```typescript
.ilike('event_code', eventSlug)
```

This makes the lookup case-insensitive so `/acqfh-2026`, `/ACQFH-2026`, or any casing will resolve correctly.

No database changes needed. No other files affected.

After this fix, navigating to `/acqfh-2026/admin/login` will load the event and display the admin login form, where you can log in with the admin credentials (`admin@congressapp.com` / `Admin2026!`).

