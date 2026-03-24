

## Plan: Add logo to Header, Login pages, Hamburger menu, and browser tab

The logo files already exist in `public/` (`logo-250px.png`, `logo-500px.png`). We will reference them in 5 locations.

### 1. Browser tab (favicon) — Already done
The `index.html` already references `/favicon.ico`, `/favicon-16x16.png`, and `/favicon-32x32.png`. No changes needed.

### 2. AppHeader (`src/components/layout/AppHeader.tsx`)
Add a small logo image (32px height) to the left of the event name in the center section, using `/logo-250px.png`.

### 3. Attendee Login (`src/pages/attendee/Login.tsx`)
Replace the text-only `<h1>` inside the gradient banner (line 69) with the logo image (`/logo-250px.png`, ~120px height, centered) followed by the event name text below it.

### 4. Admin Login (`src/pages/admin/Login.tsx`)
Replace the ShieldCheck icon (lines 63-65) with the logo image (`/logo-250px.png`, ~80px height), keeping the title and description text below.

### 5. Hamburger Menu (`src/components/layout/HamburgerMenu.tsx`)
Replace the text-only `SheetTitle` (line 49-51) with a row containing the logo image (`/logo-250px.png`, ~28px height) next to the app name text.

### Files to modify
- `src/components/layout/AppHeader.tsx`
- `src/pages/attendee/Login.tsx`
- `src/pages/admin/Login.tsx`
- `src/components/layout/HamburgerMenu.tsx`

