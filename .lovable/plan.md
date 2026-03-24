

## Plan: Replace icon files in public/ with uploaded versions

Copy each uploaded file to its corresponding location in `public/`, overwriting the existing files:

1. `user-uploads://favicon.ico` → `public/favicon.ico`
2. `user-uploads://favicon-16x16.png` → `public/favicon-16x16.png`
3. `user-uploads://favicon-32x32.png` → `public/favicon-32x32.png`
4. `user-uploads://apple-touch-icon.png` → `public/apple-touch-icon.png`
5. `user-uploads://icon-192x192.png` → `public/icon-192x192.png`
6. `user-uploads://icon-512x512.png` → `public/icon-512x512.png`
7. `user-uploads://og-image.png` → `public/og-image.png`

No changes to `index.html` or `manifest.json` — references are already correct.

