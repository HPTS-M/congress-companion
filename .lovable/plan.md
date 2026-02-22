

# Contacts / Networking Module

## Overview

Build the full Contacts page with two tabs (Participantes directory and Mis Contactos), a service layer, hooks, and test data. This requires database changes (new columns + RLS policy + test data) and several new frontend files.

## 1. Database Changes

### 1a. Add specialty and institution columns to attendees

The attendees table lacks `specialty` and `institution` columns needed for the directory cards.

```sql
ALTER TABLE public.attendees 
  ADD COLUMN specialty text,
  ADD COLUMN institution text;
```

### 1b. Add RLS policy for attendee directory

Currently attendees can only see their own record. We need a PERMISSIVE policy so authenticated attendees can view other attendees in the same event (for the directory listing).

```sql
CREATE POLICY "Attendees can view same event attendees"
ON public.attendees FOR SELECT TO authenticated
USING (
  event_id IN (
    SELECT event_id FROM public.attendees WHERE user_id = auth.uid()
  )
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);
```

Note: This is a RESTRICTIVE policy by default in Supabase. Since the existing policies are also RESTRICTIVE, we actually need to verify the policy type. Looking at the existing policies -- they are all `Permissive: No` (RESTRICTIVE). This means they act as AND filters. We need a different approach: all the existing SELECT policies are RESTRICTIVE, so adding another RESTRICTIVE one won't help. We need to change strategy and create a PERMISSIVE policy for the directory view.

Actually, re-reading the RLS policies: all policies shown say "Permissive: No" which means RESTRICTIVE. But the "Attendees can view own record" already works for the current user. The issue is that for the directory, we need to see OTHER attendees too.

The correct approach: Add a new policy (must be PERMISSIVE to actually grant access):

```sql
CREATE POLICY "Attendees view event directory"
ON public.attendees FOR SELECT TO authenticated
USING (
  event_id IN (
    SELECT a.event_id FROM public.attendees a WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL
  )
  AND deleted_at IS NULL
  AND registration_status = 'confirmed'
);
```

This will be created as PERMISSIVE (the default). The existing RESTRICTIVE `block_anon_access` won't affect authenticated users.

### 1c. Update contacts RLS

The existing `Attendees manage own contacts` policy is RESTRICTIVE. We need to verify it works for INSERT/SELECT/UPDATE/DELETE. Looking at the policy: it allows ALL where `user_id` or `contact_id` matches the current attendee. This should work, but being RESTRICTIVE means it needs at least one PERMISSIVE policy too. We should add a PERMISSIVE SELECT policy for contacts.

```sql
CREATE POLICY "Authenticated read own contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
  OR contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated insert contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (
  contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated delete contacts"
ON public.contacts FOR DELETE TO authenticated
USING (
  user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
  OR contact_id IN (SELECT id FROM attendees WHERE user_id = auth.uid())
);
```

### 1d. Insert 5 test attendees

Insert test attendees for event `5efca36a-deef-489b-be85-3dc9d1501ed7` with specialties and institutions. These won't have `user_id` (they are directory-only test data).

## 2. New Files

### 2a. `src/services/contacts.service.ts`

Service layer with functions:
- `getEventAttendees(eventId)` -- fetches all confirmed attendees for the event (id, full_name, specialty, institution, email)
- `getMyContacts(attendeeId)` -- fetches contacts where user_id or contact_id matches
- `sendRequest(eventId, userId, contactId)` -- INSERT into contacts
- `acceptRequest(contactId)` -- UPDATE status to 'accepted'
- `rejectRequest(contactId)` -- DELETE from contacts

### 2b. `src/hooks/useContacts.ts`

TanStack Query hooks:
- `useEventAttendees(eventId)` -- query for directory
- `useMyContacts(attendeeId)` -- query for contacts tab
- `useSendContactRequest()` -- mutation
- `useAcceptContact()` -- mutation
- `useRejectContact()` -- mutation

### 2c. `src/pages/attendee/Contacts.tsx`

Main page component with:
- Title "Networking" + subtitle
- Two tabs: "Participantes" and "Mis Contactos"
- Tab 1: Search bar + attendee list with connect/sent/connected buttons
- Tab 2: Pending requests section (if any) + accepted contacts list
- Empty states for each scenario
- Skeleton loading states

### 2d. `src/pages/attendee/AttendeeProfile.tsx`

Simple profile view page:
- Large avatar (80px) with initials
- Full name, specialty, institution
- Connection status button
- Route: `/:eventSlug/contacts/:attendeeId`

## 3. Modified Files

### 3a. `src/App.tsx`

- Import Contacts page (lazy)
- Import AttendeeProfile page (lazy)
- Replace placeholder route for contacts with actual Contacts component
- Add route for `contacts/:attendeeId` (profile)

### 3b. `src/locales/es/contacts.json`

Expand with all needed keys:
- `pageTitle`, `pageSubtitle`
- Tab labels (update from "Chat Grupal" to "Mis Contactos")
- Button labels: `connect`, `sent`, `accept`, `reject`, `chat`, `viewProfile`
- Empty states: `noParticipants`, `noContacts`, `noPendingRequests`
- Pending section: `pendingRequests`, `pendingCount`
- Profile labels

### 3c. `src/locales/en/contacts.json`

English mirror of the Spanish locale file.

### 3d. `src/types/index.ts`

Add interfaces for `Contact` type if needed (or keep in service file).

## 4. Technical Details

### Data flow for connection buttons

```text
Participantes tab:
1. Fetch all event attendees (excluding self)
2. Fetch all contacts for current attendee
3. Cross-reference to determine button state:
   - No contact row -> "Conectar" button
   - Contact row with status='pending' where user_id=self -> "Enviado" (disabled)
   - Contact row with status='pending' where contact_id=self -> show in pending requests
   - Contact row with status='accepted' -> "Conectado" (teal)
```

### RLS consideration

The `contacts.user_id` and `contacts.contact_id` reference `attendees.id` (not `auth.uid()`). The service layer must first resolve the current user's attendee ID from `useAuth().attendee.id` before querying.

### Files summary

| File | Action |
|---|---|
| Migration SQL | Add columns + RLS policies + test data |
| `src/services/contacts.service.ts` | New -- service layer |
| `src/hooks/useContacts.ts` | New -- TanStack Query hooks |
| `src/pages/attendee/Contacts.tsx` | New -- main contacts page |
| `src/pages/attendee/AttendeeProfile.tsx` | New -- profile view |
| `src/App.tsx` | Update routes |
| `src/locales/es/contacts.json` | Expand i18n keys |
| `src/locales/en/contacts.json` | Expand i18n keys |
