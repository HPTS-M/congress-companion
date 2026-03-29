

## Fix: Logo still showing old cached version

### Root Cause
The file `public/logo-acqfh.jpg` existed before with the old Health Plus Travels logo. The new image was written with the same filename, so the browser (and PWA service worker cache) serves the old version.

### Solution
1. Copy the uploaded image again with a **new filename** to bust the cache: `public/logo-acqfh-v2.jpg`
2. Update `src/components/layout/AppHeader.tsx` to reference `/logo-acqfh-v2.jpg`

### Files changed
1. New file: `public/logo-acqfh-v2.jpg` (copy from `user-uploads://1646950818859.jpg`)
2. `src/components/layout/AppHeader.tsx` — change src from `/logo-acqfh.jpg` to `/logo-acqfh-v2.jpg`

