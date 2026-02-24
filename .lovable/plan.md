

# Notes Module

## Overview
Build a personal notes feature at `/:eventSlug/notes` with CRUD operations, session linking, auto-save with debounce, and a note editor modal.

## Database Changes

### 1. GRANT SELECT/INSERT/UPDATE/DELETE on `attendee_notes`
The table has zero grants for any role. Need full CRUD for `authenticated`.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendee_notes TO authenticated;
GRANT SELECT ON public.attendee_notes TO anon;
```

### 2. Fix RLS policies
The existing "Attendees manage own notes" policy is RESTRICTIVE (not PERMISSIVE). Combined with `block_anon_access` (also RESTRICTIVE), authenticated users will get denied. Need to either drop and recreate as PERMISSIVE, or add a PERMISSIVE policy.

```sql
-- Drop the broken RESTRICTIVE policy
DROP POLICY IF EXISTS "Attendees manage own notes" ON attendee_notes;

-- Create as PERMISSIVE
CREATE POLICY "Attendees manage own notes"
ON attendee_notes FOR ALL TO authenticated
USING (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM attendees WHERE user_id = auth.uid()));
```

### 3. Insert 2 test notes
For attendee `fb9cb992-242e-41d2-98f8-cc28bf70edce` (Usuario de Prueba), event `5efca36a-deef-489b-be85-3dc9d1501ed7`.

## New Files

### `src/locales/es/notes.json`
i18n keys: title, subtitle, newNote, generalNote, placeholder, saved, saving, deleteConfirm, empty, sessionFilter, allSessions, exportPdf, editor title, delete toast, back

### `src/locales/en/notes.json`
English mirror of above.

### `src/services/notes.service.ts`
- `getByEvent(eventId, attendeeId)` -- fetch notes with joined session title
- `create(eventId, attendeeId, sessionId, content)` -- insert new note
- `update(noteId, content, sessionId)` -- update note content/session
- `remove(noteId)` -- delete note

### `src/hooks/useNotes.ts`
- `useNotes(eventId, attendeeId)` -- TanStack Query hook
- `useCreateNote()` -- mutation
- `useUpdateNote()` -- mutation with debounced auto-save
- `useDeleteNote()` -- mutation

### `src/pages/attendee/Notes.tsx`
Full page with:

**List view:**
- Title "Mis Notas" + subtitle
- Session filter dropdown (top left) using shadcn Select
- "Nueva Nota" button (top right, primary color)
- Note cards: session badge (teal), content preview (2 lines), last edit timestamp
- Tap card opens editor dialog
- Delete via alert dialog confirmation
- Empty state, loading skeletons

**Editor (Dialog/modal):**
- Session selector dropdown
- Full-height textarea with auto-save (3s debounce)
- "Guardado" / "Guardando..." indicator
- Back/close saves and returns

## Modified Files

### `src/lib/i18n.ts`
Add `notes` namespace imports for ES and EN.

### `src/App.tsx`
Replace `PlaceholderPage` on the notes route with the new lazy-loaded `Notes` component.

## Technical Details

### Auto-save
- Use `useEffect` with a 3-second debounce timer
- On content or session change, reset timer
- Call `notesService.update()` when timer fires
- Show "Guardando..." during save, "Guardado" on success

### Session filter
- Fetch sessions from `event_activities` for the event
- Dropdown options: "Todas las sesiones" + session list
- Filter notes by selected session_id (or show all)

### Note card layout
```text
[Teal badge: Session name or "Nota general"]
Preview text (2 lines, truncated)...
                          hace 2 horas  (bottom right)
```

### Date formatting
Use `date-fns` with `formatDistanceToNow` for relative timestamps.

### Export PDF
Defer to a simple `window.print()` approach or a basic blob generation -- keep it simple for now, can enhance later.

### Delete flow
- Long press not easily implementable in web -- use a trash icon on each card instead
- Confirm with AlertDialog before deletion
