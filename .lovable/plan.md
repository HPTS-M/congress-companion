

## Replace header logo with uploaded ACQFH image

### Changes

#### 1. Copy uploaded image to `public/`
- Copy `user-uploads://1646950818859.jpg` → `public/logo-acqfh.jpg`

#### 2. `src/components/layout/AppHeader.tsx` (line 33)
- Change `src="/logo-250px.png"` to `src="/logo-acqfh.jpg"`

