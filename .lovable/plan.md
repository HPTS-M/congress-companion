

## Plan: Install and Configure Sentry for Observability

### Summary
Add Sentry error tracking and performance monitoring to the app with custom Supabase breadcrumbs.

### Changes

#### 1. Install dependency
- Add `@sentry/react` to `package.json`

#### 2. New: `src/lib/sentry.ts`
- Export `initSentry()` that reads `VITE_SENTRY_DSN` from `import.meta.env`
- Configure `browserTracingIntegration`, `tracesSampleRate: 1.0`, trace propagation targets for localhost, Supabase, and Vercel domains
- Export `Sentry` namespace for use elsewhere

#### 3. New: `src/lib/supabase-logger.ts`
- Export `logSupabaseQuery(table, operation, durationMs, error?)` that adds Sentry breadcrumbs and captures exceptions on error

#### 4. Edit: `src/main.tsx`
- Import and call `initSentry()` as the very first line (before any other imports/rendering)
- Wrap `<App />` with `<Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>`

#### 5. Edit: `src/vite-env.d.ts`
- Add `VITE_SENTRY_DSN` to the `ImportMetaEnv` interface for type safety

### Files
1. **New**: `src/lib/sentry.ts`
2. **New**: `src/lib/supabase-logger.ts`
3. **Edit**: `src/main.tsx`
4. **Edit**: `src/vite-env.d.ts`

### Notes
- DSN comes from `VITE_SENTRY_DSN` env var (already in Vercel) — nothing hardcoded
- No changes to `vite.config.ts` or PWA/Workbox config
- `supabase-logger.ts` is a standalone helper — not wired into existing services in this step (can be integrated later)

