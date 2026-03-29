

## Fix: Language toggle button not working

### Root Cause
The `LanguageDetector` plugin returns the full browser locale (e.g. `es-CO`, `en-US`), but `toggleLanguage` compares against the short code `es`. Since `"es-CO" !== "es"`, the toggle logic breaks. Additionally, `caches: []` means the language choice is never saved — on reload it resets to the browser default.

### Changes

#### 1. `src/lib/i18n.ts`
- Add `supportedLngs: ['es', 'en']` — this tells i18next to map `es-CO` → `es`, `en-US` → `en`
- Add `load: 'languageOnly'` — strips region codes so `i18n.language` always returns `es` or `en`
- Change `caches: []` to `caches: ['localStorage']` so the user's choice persists across reloads

#### 2. `src/components/layout/AppHeader.tsx`
- Add `i18n.language.startsWith('es')` as a fallback safety check (belt-and-suspenders with the i18n config fix)

### Result
- Globe button correctly toggles between Spanish and English
- Choice persists after page reload
- No other files affected

