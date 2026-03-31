

## Plan: Fix sponsor logos not displaying

### Problem
The `logo_url` column stores a **Supabase Storage path** (e.g. `{event_id}/logo-1234567.png`), not a URL. The attendee-facing components (`Commercial.tsx`, `SponsorDetail.tsx`) use it directly as `<img src={sponsor.logo_url}>`, producing broken images. The admin side already has `getSignedUrl()` but the attendee service doesn't resolve paths to signed URLs.

### Solution
Resolve `logo_url` paths to signed URLs in `sponsors.service.ts` before returning data. This way all consumers automatically get displayable URLs.

### Changes

#### 1. Edit: `src/services/sponsors.service.ts`
- Add a helper function `resolveLogoUrl(path)` that calls `supabase.storage.from('event-sponsors').createSignedUrl(path, 3600)` and returns the signed URL
- In `getByEvent()`: after fetching and sorting, map over results and resolve each `logo_url` (and `materials_url`) to signed URLs
- In `getById()`: resolve `logo_url` and `materials_url` before returning

#### 2. No component changes needed
Both `Commercial.tsx` and `SponsorDetail.tsx` already render `sponsor.logo_url` in `<img src>` — once the service returns actual URLs, they'll just work.

### Technical detail
```ts
// In sponsors.service.ts
async function resolveStorageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('event-sponsors')
    .createSignedUrl(path, 3600);
  if (error) return '';
  return data.signedUrl;
}

// Applied in getByEvent and getById after fetching data:
// sponsor.logo_url = await resolveStorageUrl(sponsor.logo_url)
// sponsor.materials_url = await resolveStorageUrl(sponsor.materials_url)
```

### Files
1. **Edit**: `src/services/sponsors.service.ts` — resolve storage paths to signed URLs

