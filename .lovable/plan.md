

## Plan: Add "Mapa del Evento" with pinch-to-zoom

### Summary
Add the uploaded venue map image as a zoomable page accessible from the hamburger menu. The image is embedded directly in `public/` (no Supabase Storage needed since it's a static asset).

### Changes

#### 1. Copy uploaded image to `public/`
- Copy `user-uploads://Plano-Congreso-ACQFH-2026.png` → `public/venue-map.png`

#### 2. Install `react-zoom-pan-pinch`
- Add to package.json dependencies

#### 3. Create `src/pages/attendee/VenueMap.tsx`
- Uses `TransformWrapper` + `TransformComponent` for pinch-to-zoom and drag
- Back button via `useNavigate`
- Hint text and "Reset zoom" button
- All strings via i18n
- Tailwind classes only, no inline styles
- Image: `<img src="/venue-map.png" />` — rendered at full width, no modifications

#### 4. `src/App.tsx` — Add route
- Lazy import `VenueMap`
- Add `<Route path="venue-map" element={<VenueMap />} />` inside attendee layout routes (after `profile`, line 164)

#### 5. `src/components/layout/HamburgerMenu.tsx`
- Import `Map` from lucide-react
- Add `{ key: 'venueMap', icon: Map, path: '/venue-map' }` after `profile` in menuItems array

#### 6. i18n keys
**`src/locales/es/common.json`**: add `"venueMap": "Mapa del Evento"` under `nav`, and top-level `"venueMap": { "title": "Mapa del Evento", "hint": "Usa dos dedos para hacer zoom · Arrastra para navegar", "resetZoom": "Restablecer zoom" }`

**`src/locales/en/common.json`**: add `"venueMap": "Venue Map"` under `nav`, and top-level `"venueMap": { "title": "Venue Map", "hint": "Pinch to zoom · Drag to navigate", "resetZoom": "Reset zoom" }`

#### 7. `vite.config.ts` — Exclude venue-map from SW image cache
Update the images cache `urlPattern` to skip `venue-map`:
```ts
urlPattern: ({ url }) =>
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/.test(url.pathname) &&
  !url.pathname.includes('venue-map'),
```

### Files changed
1. New: `public/venue-map.png`
2. `package.json` — add `react-zoom-pan-pinch`
3. New: `src/pages/attendee/VenueMap.tsx`
4. `src/App.tsx` — lazy import + route
5. `src/components/layout/HamburgerMenu.tsx` — add Map menu item
6. `src/locales/es/common.json` — add keys
7. `src/locales/en/common.json` — add keys
8. `vite.config.ts` — exclude venue-map from image cache

