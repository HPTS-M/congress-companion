

## Fix: Profile link in hamburger menu leads to 404

### Root Cause
The hamburger menu (`src/components/layout/HamburgerMenu.tsx` line 25) has a menu item pointing to `/profile`, but no route exists for that path. The only profile route is `/contacts/:attendeeId` which shows another attendee's profile.

### Solution
Create a simple "My Profile" page that shows the current attendee's own information (name, email, specialty, institution, credential code, QR). This is distinct from the `AttendeeProfile` page which is for viewing *other* attendees.

### Changes

#### 1. `src/pages/attendee/MyProfile.tsx` — New file
- Display current user's info from `useAuth().attendee`
- Show: full name, email, specialty, institution, credential code
- Show QR code (reuse pattern from Home page)
- Logout button at bottom
- Use i18n keys from `common` namespace

#### 2. `src/App.tsx` — Add route
- Add lazy import for `MyProfile`
- Add `<Route path="profile" element={<MyProfile />} />` inside the attendee layout routes

#### 3. `src/locales/es/common.json` + `src/locales/en/common.json`
- Add keys: `profile.title`, `profile.specialty`, `profile.institution`, `profile.email`

### Result
- Hamburger menu "Perfil" link works correctly
- Attendee sees their own profile information
- No changes to existing attendee-to-attendee profile view

