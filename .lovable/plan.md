

# Fix Commercial Module: Add Columns + Contact Buttons

## 1. Database Migration

Add 5 new nullable columns to the `sponsors` table:

```sql
ALTER TABLE sponsors ADD COLUMN whatsapp text;
ALTER TABLE sponsors ADD COLUMN video_url text;
ALTER TABLE sponsors ADD COLUMN social_linkedin text;
ALTER TABLE sponsors ADD COLUMN social_instagram text;
ALTER TABLE sponsors ADD COLUMN social_twitter text;
```

Update test data: set `whatsapp` and some social links on a couple of sponsors so the buttons are visible for testing.

## 2. Update `src/services/sponsors.service.ts`

Add the new fields to the `Sponsor` interface:
- `whatsapp: string | null`
- `video_url: string | null`
- `social_linkedin: string | null`
- `social_instagram: string | null`
- `social_twitter: string | null`

No query changes needed since we already `select('*')`.

## 3. Update `src/pages/attendee/SponsorDetail.tsx`

Add to the actions section (below existing website/materials buttons):

- **WhatsApp button**: `variant="outline"`, opens `https://wa.me/{whatsapp}` in new tab. Only rendered if `sponsor.whatsapp` exists. Icon: `MessageCircle` from lucide.
- **Contact email button**: Already exists in current code -- just confirming it stays as-is (`mailto:{contact_email}`).
- **Social links row**: A horizontal row of icon buttons for LinkedIn, Instagram, Twitter (X). Each only rendered if the corresponding field has a value. Opens URL in new tab.
- **Video link**: Button to open `video_url` in new tab if present. Icon: `Play` or `Video` from lucide.

## 4. Update Locale Files

Add new keys to `es/commercial.json` and `en/commercial.json`:

```json
"detail": {
  "whatsapp": "WhatsApp",
  "video": "Ver video",
  "social": "Redes sociales"
}
```

## 5. Files Changed

| File | Change |
|---|---|
| `supabase/migrations/...` | Add 5 columns + update test data |
| `src/services/sponsors.service.ts` | Add new fields to interface |
| `src/pages/attendee/SponsorDetail.tsx` | Add WhatsApp, social links, video buttons |
| `src/locales/es/commercial.json` | Add new i18n keys |
| `src/locales/en/commercial.json` | Mirror keys |

After implementation, navigate to sponsor detail page and take screenshot.

