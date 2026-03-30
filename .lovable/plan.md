

## Plan: Replace QR code with congress logo on Home screen

### Summary
Remove the QR code from the Home screen and replace it with the uploaded congress logo. The QR and credential code are already accessible in the attendee's Profile page, so they are redundant here.

### Changes

#### 1. Copy uploaded logo to project
- Copy `user-uploads://image-27.png` to `public/logo-congreso.png`

#### 2. Edit: `src/pages/attendee/Home.tsx`
- Remove `QRCodeSVG` import and `qrcode.react` dependency usage
- Replace the QR code block (lines 43-56) with a large congress logo image (`/logo-congreso.png`), centered, ~200px height
- Remove the credential code text and "show to staff" caption
- Keep the event logo from `event.settings.logo_url` if it exists (or replace it with the static congress logo — both show the same branding)
- The card becomes a welcome/branding card instead of a credential card

#### 3. Update i18n keys (optional cleanup)
- The `home.showToStaff` key becomes unused — can be left for now or removed from `es/common.json` and `en/common.json`

### Result
The Home screen center card will show the congress logo prominently instead of a QR code, creating a cleaner welcome experience. Attendees access their QR credential via the profile icon in the header.

