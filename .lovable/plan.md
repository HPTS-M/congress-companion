

## Plan: Make the notification bell functional

### Summary
Create a hook to track unread announcements and pending chat invites, wire it to the bell icon with a dynamic badge and smart navigation.

### Changes

#### 1. New: `src/hooks/useUnreadCount.ts`
- Fetches announcements via `announcementsService.getByEvent()` and conversations via `messagingService.getDirectConversations()`
- Compares `sent_at` (announcements) and `last_message_at` (conversations) against a `localStorage` timestamp (`notifications_last_seen_{attendeeId}`)
- Counts pending chat invites where `participant_id === attendeeId` (incoming invites only)
- Returns `{ unreadCount, pendingInvites, unreadAnnouncements, unreadMessages, markAsSeen }`
- Refetches every 30 seconds
- Note: announcements use `sent_at` (not `created_at` — the field in the actual service/interface)

#### 2. Edit: `src/components/layout/AppHeader.tsx`
- Import `useUnreadCount` and `useAuth`
- Get `event.id` from `useEvent()` and `attendee` from `useAuth()`
- Replace the static bell button with:
  - `onClick` → calls `markAsSeen()`, then navigates to `/messaging` if `pendingInvites > 0`, otherwise to `/announcements`
  - Badge only renders when `unreadCount > 0`, shows number (max "99+")
  - Uses Tailwind classes (no inline styles) per project guidelines

#### 3. Edit: `src/locales/es/common.json` + `src/locales/en/common.json`
- Add under existing `"notifications"` key: `"badge"` and `"markAsSeen"` translations

### Files
1. **New**: `src/hooks/useUnreadCount.ts`
2. **Edit**: `src/components/layout/AppHeader.tsx`
3. **Edit**: `src/locales/es/common.json`
4. **Edit**: `src/locales/en/common.json`

### No migration needed
Uses `localStorage` for read tracking — no database changes required.

