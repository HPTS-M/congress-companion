

# Build Check-in Module

## Overview

Create the Check-in page at `/:eventSlug/checkin` that allows attendees to scan QR codes displayed at the end of sessions to record their attendance. Includes a simulated scan mode for development.

## Files to Create

### 1. `src/pages/attendee/CheckIn.tsx`
The main Check-in page with:
- Page title "Check-in" + subtitle from i18n
- Centered card (max-w-md) with:
  - Camera viewport placeholder (280x280, dashed teal border, 5% teal bg, QR icon centered)
  - "Escanear QR de Actividad" button (bg #00B89F, full width)
  - "Simular Escaneo" dev button (outline, visible when `VITE_DEV_MODE=true`)
- Recent check-ins section showing last 3 with session title, time, and green checkmark
- On scan: parse QR format `congressapp:{event_id}:{session_id}`, validate, insert into `attendee_checkins`, show toast, invalidate checkin queries

### 2. `src/services/checkin.service.ts`
Service layer for check-in operations:
- `getRecentCheckins(attendeeId)` -- fetches last 3 check-ins with activity title (join `event_activities`)
- `performCheckin(activityId, attendeeId)` -- calls the existing `process_checkin` database function
- `isAlreadyCheckedIn(activityId, attendeeId)` -- checks for existing record

### 3. `src/hooks/useCheckin.ts`
TanStack Query hooks:
- `useRecentCheckins(attendeeId)` -- query for last 3 check-ins
- `usePerformCheckin()` -- mutation that invalidates both checkin and agenda queries on success

## Files to Modify

### 4. `src/locales/es/checkin.json`
Add missing keys:
- `scanTitle`, `scanSubtitle`, `cameraPlaceholder` (update), `successWithTitle`, `recentTitle`, `checkedInAt`, `simulatePrompt`, `selectActivity`, `noRecentCheckins`

### 5. `src/locales/en/checkin.json`
Mirror of Spanish keys in English.

### 6. `src/App.tsx`
Replace the checkin PlaceholderPage route with the new CheckIn component (lazy loaded).

## Dev Simulate Flow

When "Simular Escaneo" is clicked:
1. Show a dialog/select with current event's activities
2. User picks one
3. Calls `process_checkin` RPC with empty quiz responses
4. Shows success/error toast

## Database

No schema changes needed. The `attendee_checkins` table and `process_checkin` function already exist and handle:
- Duplicate check-in prevention
- Quiz score calculation (defaults to 100 if no quiz)
- Certificate placeholder generation

## Technical Details

- QR scanning uses `html5-qrcode` library (needs to be installed)
- QR format: `congressapp:{event_id}:{session_id}`
- After successful check-in, invalidate `['user-checkins', attendeeId]` query key so the Agenda page updates the teal circle
- `VITE_DEV_MODE` accessed via `import.meta.env.VITE_DEV_MODE`
- All text uses `checkin` i18n namespace
- The `process_checkin` RPC takes `_activity_id`, `_attendee_id`, and `_quiz_responses` (pass `'{}'::jsonb` for simple scans)

