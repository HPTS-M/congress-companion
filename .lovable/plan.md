

## Plan: Wire venue map into hamburger menu

### Summary
The venue map menu entry was never added to the `menuItems` array despite the `Map` icon being imported and the route/page existing. This is a one-line fix.

### Changes

#### 1. Edit: `src/components/layout/HamburgerMenu.tsx`
- Add `{ key: 'venueMap', icon: Map, path: '/venue-map' }` to the `menuItems` array after `ratings`
- The `Map` icon import already exists
- The translation key `nav.venueMap` already exists in both `en/common.json` and `es/common.json`

### Files
1. **Edit**: `src/components/layout/HamburgerMenu.tsx` — add 1 line to `menuItems`

