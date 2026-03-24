

## Plan: Generate PWA icons from existing logos and update references

### What we'll do

Use a Node.js script (via `sharp`) to resize/crop the three logo files already in `public/` into all required icon sizes, then update `index.html` and `manifest.json` to reference them.

### Step 1 — Generate icon files with a build script

Install `sharp` temporarily and run a script that produces:

| Output file | Source | Size | Notes |
|---|---|---|---|
| `public/favicon.ico` | logo-250px.png | 32x32 | Cropped to isotipo (center square) |
| `public/favicon-16x16.png` | logo-250px.png | 16x16 | Cropped to isotipo |
| `public/favicon-32x32.png` | logo-250px.png | 32x32 | Cropped to isotipo |
| `public/apple-touch-icon.png` | logo-500px.png | 180x180 | Full logo, resized |
| `public/icon-192x192.png` | logo-500px.png | 192x192 | Full logo, resized |
| `public/icon-512x512.png` | logo-1000px.png | 512x512 | Full logo, resized |
| `public/og-image.png` | logo-1000px.png | as-is | Copy |

For the favicon/isotipo crops: the script will extract the left portion of the logo (the cross icon) by cropping a square from the left side before resizing.

For `.ico` format: sharp outputs a 32x32 PNG which we rename to `.ico` (browsers accept PNG-in-ICO).

### Step 2 — Update `index.html`

Add proper favicon and OG image references:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<meta property="og:image" content="/og-image.png" />
```

### Step 3 — Update `manifest.json`

Replace the icons array with all PWA sizes:

```json
"icons": [
  { "src": "/favicon-32x32.png", "sizes": "32x32", "type": "image/png" },
  { "src": "/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
]
```

### Technical notes

- The isotipo crop requires knowing the logo layout. The script will read the image dimensions, then crop a square from the left side (height x height) to isolate the cross icon.
- `sharp` will be installed via `npx` or temporary install — no permanent dependency added.

