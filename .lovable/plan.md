

## Plan: PWA Offline Support with vite-plugin-pwa

### What we're building
Replace the hand-written `public/sw.js` with `vite-plugin-pwa` + Workbox for proper offline caching of static assets and Supabase API data. Add an offline indicator banner and guard realtime subscriptions.

### Changes

#### 1. `package.json` — Add dependencies
- `vite-plugin-pwa` (devDependency)
- `workbox-window` (devDependency, used internally by the plugin)

#### 2. `vite.config.ts` — Add VitePWA plugin
- Import `VitePWA` from `vite-plugin-pwa`
- Configure with `registerType: 'autoUpdate'`, `devOptions: { enabled: false }`
- Set manifest (name, short_name, theme_color, icons matching existing `manifest.json`)
- Add `workbox.navigateFallbackDenylist: [/^\/~oauth/]`
- Add 4 runtime caching rules:
  - **Supabase data** (activities, sponsors, attendees, documents) — StaleWhileRevalidate, 24h
  - **Announcements** — NetworkFirst, 2h
  - **Images** — CacheFirst, 7 days
  - **Supabase Storage** — CacheFirst, 3 days

#### 3. `index.html` — Remove manual SW registration
- Delete the `<script>` block that registers `/sw.js` (lines 32-38)
- Remove `<link rel="manifest">` (vite-plugin-pwa injects it automatically)

#### 4. `public/sw.js` — Delete file
- No longer needed; Workbox generates the service worker at build time

#### 5. `src/main.tsx` — Add iframe/preview guard
- Add guard that unregisters service workers when running inside Lovable preview iframe or on preview hosts
- This prevents caching issues during development

#### 6. `src/App.tsx` — Add offline banner
- Add `useState(navigator.onLine)` + `useEffect` with online/offline event listeners
- Render a sticky amber banner "Sin conexión — mostrando datos guardados" when offline
- Use i18n key `common.offlineBanner`

#### 7. Realtime hooks — Guard subscriptions when offline
- `src/hooks/usePolls.ts` — wrap both `useEffect` realtime subscriptions with `if (!navigator.onLine) return`
- `src/hooks/useAnnouncements.ts` — no realtime subscription exists, no change needed
- `src/hooks/useMessaging.ts` — no realtime in this hook (it's in the components); the DirectChatView component already handles its own subscription — add online guard there

#### 8. `src/components/attendee/DirectChatView.tsx` — Guard realtime
- Add `if (!navigator.onLine) return` before the Supabase channel subscription

#### 9. `src/locales/es/common.json` + `src/locales/en/common.json` — Add key
- `"offlineBanner": "Sin conexión — mostrando datos guardados"` (ES)
- `"offlineBanner": "Offline — showing cached data"` (EN)

#### 10. `public/manifest.json` — Delete or keep as fallback
- Delete it since vite-plugin-pwa generates the manifest automatically from config

### What stays untouched
- Push notification logic (will be re-added in a custom SW extension if needed later)
- Auth tokens / session data — never cached by Workbox (different origin/path)
- Chat messages and poll responses — not cached (realtime-only)
- Admin modules — no offline changes

### Technical note
The existing `public/sw.js` includes push notification handlers. Since vite-plugin-pwa generates its own SW, push handling will need to be re-added via the `injectManifest` strategy in a future iteration if push notifications are actively used. For now the `generateSW` approach covers offline caching which is the primary goal.

