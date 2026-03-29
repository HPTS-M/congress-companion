

## Move Profile from Hamburger Menu to Header User Icon

### Summary
Remove "Mi Perfil" from the hamburger menu and make the User icon button in the header navigate to the profile page. This declutters the menu and gives the profile icon actual functionality.

### Changes

#### 1. `src/components/layout/HamburgerMenu.tsx`
- Remove the `profile` entry from `menuItems` array (line 25)
- Remove `User` from lucide-react imports (no longer needed)

#### 2. `src/components/layout/AppHeader.tsx`
- Add `useNavigate` from react-router-dom and `useEventSlug` from `@/hooks/useEvent`
- Add `onClick` handler to the User icon button that navigates to `/${eventSlug}/profile`

#### 3. No other changes
- Profile page, route, and i18n keys remain as-is

