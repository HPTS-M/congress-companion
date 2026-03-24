

## Plan: Replace "CONGRÉSSAPP" with "Health Plus Travels Events"

Update all user-facing occurrences of "CONGRÉSSAPP" across the app. Code comments will be left unchanged.

### Files to modify

1. **`src/locales/es/common.json`** — `"appName": "Health Plus Travels Events"`
2. **`src/locales/en/common.json`** — `"appName": "Health Plus Travels Events"`
3. **`index.html`** — Title and og:title → "Health Plus Travels Events"
4. **`public/manifest.json`** — `name` and `short_name` → "Health Plus Travels Events"
5. **`public/sw.js`** — Default notification title → "Health Plus Travels Events"
6. **`src/components/layout/AdminLayout.tsx`** — Sidebar header text → "Health Plus Travels Events"
7. **`supabase/functions/send-email/index.ts`** — FROM name → "Health Plus Travels Events"
8. **`supabase/functions/create-provider-user/index.ts`** — FROM name, email subject, and body text references

### Not modified (code comments only)
- `tailwind.config.ts`, `src/index.css` — design system comments
- `docs/PRODUCT_OWNER_USER_STORIES.md` — internal documentation

