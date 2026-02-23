

# Fix: Login Redirect, Session Duration, and Error Feedback

## Problem Analysis

The login page has a race condition: after `loginWithCode` succeeds, `navigate()` fires immediately on line 39, but `useAuth`'s `onAuthStateChange` listener hasn't updated `isAttendee` yet. If the component re-renders before navigation completes, the synchronous check on lines 23-26 sees `isAuthenticated = false` (stale) and doesn't redirect. On return visits with a valid session, the same synchronous check fails because `isAttendee` updates asynchronously via `loadAttendeeProfile`.

## Changes

### 1. `src/pages/attendee/Login.tsx` -- Add useEffect redirect + error state

Replace the synchronous redirect (lines 22-26) with a `useEffect` that watches `session` and `isAttendee`:

```typescript
import { useState, useEffect } from 'react';

// Destructure session from useAuth
const { loginWithCode, isAuthenticated, isAttendee, session } = useAuth();

// Error state for inline feedback
const [loginError, setLoginError] = useState('');

// Reactive redirect when auth state updates
useEffect(() => {
  if (session && eventSlug) {
    navigate(`/${eventSlug}/home`, { replace: true });
  }
}, [session, eventSlug, navigate]);
```

Remove the old synchronous `if (isAuthenticated && isAttendee)` block entirely.

Add inline error display below the input field:

```tsx
{loginError && (
  <p className="text-sm text-red-600 dark:text-red-400 text-center">
    {loginError}
  </p>
)}
```

Update `handleSubmit` catch block to set `loginError` instead of (or in addition to) toast:

```typescript
catch (err) {
  const errorMsg = err instanceof Error ? err.message : '';
  const messages = { /* existing map */ };
  setLoginError(messages[errorMsg] || t('error'));
}
```

Clear error on input change: `onChange` sets `setLoginError('')`.

### 2. `supabase/functions/verify-access-code/index.ts` -- 8-hour session

Currently `generateLink` uses Supabase's default OTP expiry. We cannot set JWT expiry directly from `generateLink`, but the session duration is controlled by the Supabase Auth config. However, we should ensure the magic link OTP doesn't expire too quickly during testing.

The actual session duration (JWT `exp`) is set in Supabase Auth settings (Dashboard > Authentication > Settings > JWT expiry). The edge function doesn't control this. But we should document this for the user.

No code change needed in the edge function for session duration -- this is a Supabase dashboard setting.

**Action for user**: Go to Supabase Dashboard > Authentication > Settings and set "JWT expiry" to `28800` (8 hours).

### 3. `src/locales/es/common.json` and `src/locales/en/common.json` -- Add session expired key

Add `auth.sessionExpired` key:
- ES: `"Tu sesion ha expirado. Ingresa tu codigo nuevamente."`
- EN: `"Your session has expired. Please enter your code again."`

### 4. `src/hooks/useAuth.tsx` -- Detect session expiry

In `onAuthStateChange`, when `_event === 'TOKEN_REFRESHED'` fails or `_event === 'SIGNED_OUT'`, the session becomes null. No extra code needed -- the existing listener already sets `isAuthenticated: false` when session is null, which causes the `AttendeeRoute` guard to redirect to login. But we should store a flag so the login page can show the "session expired" message.

Add to `onAuthStateChange`:
```typescript
if (_event === 'SIGNED_OUT' && prev.isAuthenticated) {
  // Session expired or user logged out
  sessionStorage.setItem('session_expired', 'true');
}
```

Then in Login.tsx, on mount check for this flag and show the expired message.

## Files Summary

| File | Change |
|---|---|
| `src/pages/attendee/Login.tsx` | Replace sync redirect with useEffect; add inline error state; check session_expired flag |
| `src/hooks/useAuth.tsx` | Set session_expired flag on SIGNED_OUT event |
| `src/locales/es/common.json` | Add `auth.sessionExpired` key |
| `src/locales/en/common.json` | Add `auth.sessionExpired` key |
| `supabase/functions/verify-access-code/index.ts` | No change needed (session duration is a dashboard setting) |

## Dashboard Action Required

Set JWT expiry to 28800 seconds (8 hours) at:
`Supabase Dashboard > Authentication > Settings > JWT expiry`

