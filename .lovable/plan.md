

## Plan: Update announcement timestamps format

### Changes

#### 1. `src/pages/attendee/Announcements.tsx`
- Replace `formatTimestamp` with new `formatAnnouncementTime` that uses i18n for "Ayer"/"Yesterday" and formats as specified:
  - Today: `"14:35"`
  - Yesterday: `"Ayer · 14:35"`
  - Older: `"lun 23 mar · 14:35"` (using date-fns locale)
- Move timestamp from the top-right of the title row to below the body content, as a `text-xs text-muted-foreground` paragraph

#### 2. `src/pages/admin/Dashboard.tsx`
- Apply same format to the "Actividad Reciente" timestamps (line 93)
- Import `isToday`, `isYesterday` from date-fns and `useTranslation` for the yesterday key
- Use the same formatting logic with locale-aware output

#### 3. `src/locales/es/announcements.json`
- Add `"yesterday": "Ayer"`

#### 4. `src/locales/en/announcements.json`
- Add `"yesterday": "Yesterday"`

### UI result
- Attendee announcements: timestamp moves below content, uses new relative format
- Admin dashboard recent activity: same timestamp format in the list items

