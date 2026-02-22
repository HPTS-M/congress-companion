

# Build Commercial Module

## Database: Insert Test Sponsors

Insert 6 test sponsors into the existing `sponsors` table for event `5efca36a-deef-489b-be85-3dc9d1501ed7`.

## New Files

| File | Purpose |
|---|---|
| `src/services/sponsors.service.ts` | Fetch sponsors by event_id, fetch single sponsor by id |
| `src/hooks/useSponsors.ts` | TanStack Query hooks: `useSponsors(eventId)` and `useSponsor(sponsorId)` |
| `src/pages/attendee/Commercial.tsx` | Sponsor directory page with search, category filters, level-grouped grid |
| `src/pages/attendee/SponsorDetail.tsx` | Individual sponsor detail page |

## Modified Files

| File | Change |
|---|---|
| `src/App.tsx` | Add lazy imports for `Commercial` and `SponsorDetail`, replace placeholder route, add `commercial/:sponsorId` route |
| `src/locales/es/commercial.json` | Add missing keys: `title` update to "Area Comercial", `subtitle` update, `allCategories`, `noResults`, detail page labels (`visitWebsite`, `downloadMaterials`, `contactEmail`) |
| `src/locales/en/commercial.json` | Mirror Spanish keys |
| `src/lib/i18n.ts` | Add `commercial` namespace to i18n config |

## Service Layer

`src/services/sponsors.service.ts`:
- `getByEvent(eventId)`: SELECT all sponsors for the event, ordered by level priority (gold first) then name
- `getById(sponsorId)`: SELECT single sponsor by id

## Hooks

`src/hooks/useSponsors.ts`:
- `useSponsors(eventId)` with 5min staleTime
- `useSponsor(sponsorId)` with 10min staleTime

## Commercial Page (`src/pages/attendee/Commercial.tsx`)

Following the same patterns as Tickets page:

1. **Header**: Page title + subtitle via i18n
2. **Search bar**: Input with search icon, filters sponsors by name, description, and stand_location (case-insensitive client-side filter)
3. **Category filter chips**: Horizontal scrollable row -- "Todos" + 5 category chips. Multi-select: clicking a chip toggles it. When none selected, show all. Active chip: `#1A56A0` bg, white text. Inactive: white bg, gray border.
4. **Level sections**: Group filtered sponsors by level in order: gold, silver, bronze, exhibitor. Each section has a header with level name + colored badge.
5. **Sponsor cards**: 2-column grid on mobile. Each card: logo placeholder (initials circle 80px if no logo_url), company name centered, category badge (gray pill), stand location, level badge (colored per spec), "Ver mas" outline button linking to detail page.
6. **Empty state**: Ticket icon + "No se encontraron patrocinadores" message
7. **Loading state**: Skeleton grid

## Sponsor Detail Page (`src/pages/attendee/SponsorDetail.tsx`)

Route: `/:eventSlug/commercial/:sponsorId`

- Back button to return to commercial list
- Logo (120px placeholder with initials if no logo_url)
- Company name 24px bold
- Level badge (colored)
- Category badge
- Full description text
- Stand location with MapPin icon
- "Visitar sitio web" button (opens in new tab, only if website_url)
- "Descargar materiales" button (only if materials_url)
- "Contactar" button (mailto link, only if contact_email)

## Locale Updates

**`src/locales/es/commercial.json`**:
```json
{
  "title": "Area Comercial",
  "subtitle": "Patrocinadores y expositores",
  "searchPlaceholder": "Buscar patrocinador...",
  "allCategories": "Todos",
  "noSponsors": "No se encontraron patrocinadores",
  "viewMore": "Ver mas",
  "level": { "gold": "Oro", "silver": "Plata", "bronze": "Bronce", "exhibitor": "Expositor" },
  "category": { "pharmaceutical": "Farmaceutica", "technology": "Tecnologia", "medical_equipment": "Equipos Medicos", "services": "Servicios", "education": "Educacion", "other": "Otro" },
  "detail": {
    "stand": "Stand",
    "website": "Visitar sitio web",
    "materials": "Descargar materiales",
    "contact": "Contactar",
    "back": "Volver"
  }
}
```

**`src/locales/en/commercial.json`**: English mirror of all keys.

## App.tsx Route Changes

- Add `Commercial` and `SponsorDetail` lazy imports
- Replace `<PlaceholderPage titleKey="nav.commercial" />` with `<Commercial />`
- Add nested route: `<Route path="commercial/:sponsorId" element={<SponsorDetail />} />`

## Level Badge Colors

- Gold: `bg-amber-100 text-amber-700` with `#F59E0B` accent
- Silver: `bg-slate-100 text-slate-500` with `#94A3B8` accent
- Bronze: `bg-orange-100 text-orange-800` with `#B45309` accent
- Exhibitor: `bg-slate-100 text-slate-600` with `#64748B` accent

## Test Data (6 sponsors)

Inserted via Supabase data tool into `sponsors` table with `event_id = '5efca36a-deef-489b-be85-3dc9d1501ed7'`.

