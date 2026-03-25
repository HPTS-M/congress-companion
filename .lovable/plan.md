

## Change default registration_status to "pending" in NewAttendeeModal

Three edits across 3 files:

### 1. `src/components/admin/attendees/NewAttendeeModal.tsx`
- **Line 21**: Change `z.string().default('confirmed')` → `z.string().default('pending')`
- **Line 50**: Change `registration_status: 'confirmed'` → `registration_status: 'pending'`

### 2. `src/locales/es/admin.json`
- **Line 199**: Change `pendingHint` to `"Las credenciales se enviarán cuando confirmes manualmente"`

### 3. `src/locales/en/admin.json`
- **Line 199**: Change `pendingHint` to `"Credentials will be sent when you confirm manually"`

No logic changes needed — the existing `onSubmit` already skips invitation sending when status is `pending`.

