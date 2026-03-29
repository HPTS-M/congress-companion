

## Replace PWA icons with congress branding icons from ZIP

### Summary
Extract the icon files from the uploaded `files_3.zip` and replace the current PWA/favicon icons in `public/` so that when users install the app on their phone, they see the congress branding.

### Changes

#### 1. Extract and copy icons from ZIP to `public/`
Using a script, extract `files_3.zip` and copy each icon file to the corresponding location in `public/`:
- `icon-512x512.png` → `public/icon-512x512.png`
- `icon-192x192.png` → `public/icon-192x192.png` (if present in ZIP)
- `apple-touch-icon.png` → `public/apple-touch-icon.png` (if present)
- `favicon-32x32.png` → `public/favicon-32x32.png` (if present)
- `favicon-16x16.png` → `public/favicon-16x16.png` (if present)
- `favicon.ico` → `public/favicon.ico` (if present)

If the ZIP only contains `icon-512x512.png`, generate the smaller sizes from it (192x192, 180x180, 32x32, 16x16, and .ico).

#### 2. No code changes needed
The `vite.config.ts` manifest already references these exact filenames, so replacing the image files is sufficient.

### Notes
- Users who already installed the PWA may need to uninstall and reinstall to see the new icon
- The `og-image.png` will not be changed (used for social sharing previews)

