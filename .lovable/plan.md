

## Plan: Add QR toggle setting to event configuration

### Summary
Add a `qr_enabled` flag to the event's `settings` JSON. Expose it in the admin panel and use it to conditionally hide QR-related features in the attendee app.

### Where QR is used (attendee side)
1. **BottomNav** — "Check-in" tab (QR scanner)
2. **CheckIn page** — entire page is QR scanning
3. **Login page** — "Scan QR" button
4. **Home page** — QR card section (currently shows logo, not QR)
5. **MyProfile** — QRCodeSVG showing credential code
6. **Tickets** — QRCodeSVG inside each ticket

### Approach

The `events.settings` JSONB column already exists and is fetched by `useEvent`. We'll use `settings.qr_enabled` (default `true`) to control visibility.

#### 1. Add helper hook: `useEventSettings`
Create a small utility in `src/hooks/useEvent.ts`:
```ts
export function useEventSettings() {
  const { event } = useEvent();
  const settings = (event?.settings ?? {}) as Record<string, unknown>;
  return {
    qrEnabled: settings.qr_enabled !== false, // default true
  };
}
```

#### 2. Update `CongressEvent` type
Add typing for settings in `src/types/index.ts`:
```ts
export interface EventSettings {
  qr_enabled?: boolean;
}
```
Update `settings` field type from `Record<string, unknown> | null` to `EventSettings | null`.

#### 3. Conditionally hide QR features (attendee)
- **BottomNav**: Filter out `checkin` tab when `qrEnabled` is false
- **Login page**: Hide "Scan QR" button and divider when `qrEnabled` is false
- **CheckIn page**: Show disabled/redirect message if accessed directly
- **MyProfile**: Hide QRCodeSVG card when `qrEnabled` is false
- **Tickets**: Hide QRCodeSVG inside ticket details when `qrEnabled` is false

#### 4. Admin settings UI
Add a toggle in the admin panel to control `qr_enabled`. This will be a new section or card on an existing admin page (e.g., Dashboard or a new Event Settings page) with a Switch component that updates the event's `settings` JSONB.

### Files to edit
1. **`src/types/index.ts`** — add `EventSettings` interface
2. **`src/hooks/useEvent.ts`** — add `useEventSettings` hook
3. **`src/components/layout/BottomNav.tsx`** — filter checkin tab
4. **`src/pages/attendee/Login.tsx`** — hide QR button
5. **`src/pages/attendee/CheckIn.tsx`** — show disabled message
6. **`src/pages/attendee/MyProfile.tsx`** — hide QR card
7. **`src/pages/attendee/Tickets.tsx`** — hide ticket QR
8. **New: `src/components/admin/EventSettingsCard.tsx`** — admin toggle UI
9. **`src/pages/admin/Dashboard.tsx`** — embed settings card
10. **`src/locales/en/common.json`** and **`es/common.json`** — add i18n keys

### No database migration needed
The `settings` JSONB column already exists. We just store `{ "qr_enabled": true/false }` in it.

