

# Phase 4: Agenda Page Implementation

## Overview

Build the full Agenda page at `/:eventSlug/agenda` with day selector tabs, session cards with type-colored borders, interest toggling, and attendance status display.

## Files to Create/Modify

### New Files

| File | Purpose |
|---|---|
| `src/services/agenda.service.ts` | Data fetching: activities, interests, checkins |
| `src/hooks/useAgenda.ts` | TanStack Query hooks for agenda data |
| `src/pages/attendee/Agenda.tsx` | Main page: day selector + session list |
| `src/components/attendee/DaySelector.tsx` | Sticky horizontal day tabs |
| `src/components/attendee/SessionCard.tsx` | Individual session card |
| `src/components/attendee/SessionSkeleton.tsx` | Loading skeleton (3 cards) |

### Modified Files

| File | Change |
|---|---|
| `src/App.tsx` | Replace PlaceholderPage on `/agenda` route with lazy-loaded Agenda |
| `src/types/index.ts` | Add `EventActivity` and `SessionInterest` interfaces |
| `src/locales/es/agenda.json` | Add missing keys (`error`, `type.conference`, etc.) |
| `src/locales/en/agenda.json` | Add matching English keys |

## Technical Details

### Data Model Mapping

The database uses `event_activities` (not `agenda_sessions` from the knowledge base). Key columns:

- `activity_type` -- maps to session type (conference, workshop, break, plenary)
- `scheduled_date` -- date grouping for day tabs
- `start_time` / `end_time` -- time display
- `location` -- room
- `speaker_name` -- speaker
- `requires_checkin` -- maps to "has certificate" badge

Interest data lives in `session_interests` (columns: `session_id`, `user_id`, `event_id`).
Attendance data lives in `attendee_checkins` (columns: `activity_id`, `attendee_id`).

### Service Layer (`agenda.service.ts`)

```text
agendaService:
  getActivities(eventId) -> SELECT * FROM event_activities WHERE event_id = ? ORDER BY scheduled_date, start_time
  getInterests(eventId) -> SELECT * FROM session_interests WHERE event_id = ?
  getUserInterests(eventId, attendeeId) -> SELECT * FROM session_interests WHERE event_id = ? AND user_id = ?
  toggleInterest(eventId, sessionId, attendeeId, isInterested) -> INSERT or DELETE from session_interests
  getUserCheckins(attendeeId) -> SELECT activity_id FROM attendee_checkins WHERE attendee_id = ?
```

### Hooks (`useAgenda.ts`)

- `useActivities(eventId)` -- fetches all activities, groups by `scheduled_date`
- `useSessionInterests(eventId)` -- fetches interest counts per session
- `useUserInterests(eventId, attendeeId)` -- fetches current user's interests
- `useUserCheckins(attendeeId)` -- fetches current user's check-in statuses
- `useToggleInterest()` -- mutation with optimistic update

### Day Selector Component

- Derives unique sorted dates from activities data
- Formats each date as "Dia N" + short date (e.g., "23 Abr")
- Uses `date-fns` (already installed) for formatting
- Sticky positioning: `sticky top-14 md:top-16 z-40` (below header)
- Active tab: `bg-[#1A56A0] text-white rounded-lg`
- Inactive tab: `bg-slate-100 dark:bg-slate-700 text-slate-500`

### Session Card Component

- Left border 4px colored by `activity_type`:
  - conference: `border-l-[#1A56A0]`
  - workshop: `border-l-[#00B89F]`
  - break: `border-l-[#F59E0B]`
  - plenary: `border-l-[#8B5CF6]`
- Content layout: title, interest count, time, room, speaker, badges
- Right side: attendance indicator (circle icon, teal if checked in)
- Bottom right: "Me interesa" toggle button
  - Uses `useMutation` with optimistic updates on `session_interests`
  - INSERT when toggling on, DELETE when toggling off

### State Management

- All data via TanStack Query with `queryKey` patterns:
  - `['activities', eventId]`
  - `['session-interests', eventId]`
  - `['user-interests', eventId, attendeeId]`
  - `['user-checkins', attendeeId]`
- Interest toggle invalidates both interest queries
- `staleTime: 5 * 60 * 1000` (5 minutes)

### i18n Keys to Add

```text
agenda.error -> "Error cargando la agenda" / "Error loading agenda"
agenda.session.time -> not needed (formatted inline)
agenda.session.location -> "Sala" / "Room" (already exists as "room")
```

### Loading / Empty / Error States

- Loading: 3 `SessionSkeleton` cards (rounded rectangles mimicking card layout)
- Empty day: centered message with `t('agenda.noSessions')`
- Error: centered error message with retry button

### Attendee ID Resolution

The `useAuth` hook provides `attendee.id` (the attendee record ID, not the auth user ID). This is what `session_interests.user_id` and `attendee_checkins.attendee_id` reference.

## Implementation Order

1. Add types to `src/types/index.ts`
2. Create `src/services/agenda.service.ts`
3. Create `src/hooks/useAgenda.ts`
4. Create `src/components/attendee/SessionSkeleton.tsx`
5. Create `src/components/attendee/DaySelector.tsx`
6. Create `src/components/attendee/SessionCard.tsx`
7. Create `src/pages/attendee/Agenda.tsx`
8. Update `src/App.tsx` route
9. Update i18n files if needed

