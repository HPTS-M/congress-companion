

# Fix Check-in: Padding + Dev Mode

## Issue 1: Title Padding

The CheckIn page already uses `px-4` on the outer wrapper (line 135). However, the Agenda page uses separate padding per section. To ensure consistency and prevent any clipping from the layout, increase to `px-4` on the header div itself (matching Agenda's `px-4 pt-4` pattern on its title block).

**Change in `src/pages/attendee/CheckIn.tsx`**: The outer div keeps `px-4 py-4`. No structural change needed here -- the padding is already correct. If the title appears cut, it may be a visual artifact of the header overlap. To be safe, add explicit `px-4` to the header `<div>` as well (belt and suspenders).

## Issue 2: VITE_DEV_MODE Not Set

**Root cause**: The `.env` file does not contain `VITE_DEV_MODE`. The button check `import.meta.env.VITE_DEV_MODE === 'true'` evaluates to `false`, so the simulate button never renders.

**Fix**: Add `VITE_DEV_MODE=true` to the `.env` file.

## Files to Modify

| File | Change |
|---|---|
| `.env` | Add `VITE_DEV_MODE=true` |

## After Fix: Test Flow

1. Navigate to Check-in tab
2. "Simular Escaneo" button should now be visible below the primary scan button
3. Click it, select an activity from the dropdown, confirm
4. Success toast should appear
5. Activity appears in "Check-ins Recientes" list below
6. Navigate to Agenda -- the session's radio should show as confirmed (teal circle)

Only one file needs changing. The padding issue should be verified visually after deployment -- the code already has `px-4`.

