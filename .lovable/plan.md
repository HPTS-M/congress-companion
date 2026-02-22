
# Build Tickets Module + Fix Check-in Padding

## Check-in Padding Fix

The current code has double padding: `px-4` on the outer div AND `px-4` on the header div, causing the title to be indented 32px from the left edge. Fix by removing the extra `px-4` from the header div, keeping only the outer wrapper's `px-4`.

**File**: `src/pages/attendee/CheckIn.tsx` line 137
- Change `<div className="px-4 pt-4">` to `<div>`

## Tickets Module: Database Setup

The `attendee_services` table references a `service_catalog_id` column, but no `service_catalog` table exists. We need to create it first, then insert test catalog entries and test attendee services. The `service_tickets` table is auto-populated by the `auto_create_service_ticket` trigger.

### Migration: Create `service_catalog` table

```sql
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  service_type text NOT NULL, -- 'transport' | 'food' | 'special' | 'tour'
  valid_from time,
  valid_until time,
  valid_day integer,
  location text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

-- Block anon
CREATE POLICY "block_anon_access" ON service_catalog FOR SELECT TO anon USING (false);

-- Authenticated attendees can read their event's catalog
CREATE POLICY "Authenticated read event catalog" ON service_catalog FOR SELECT TO authenticated
USING (event_id IN (SELECT event_id FROM attendees WHERE user_id = auth.uid()));

-- Admin/superuser management
CREATE POLICY "Superusers manage all catalog" ON service_catalog FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Add FK from attendee_services
ALTER TABLE attendee_services ADD CONSTRAINT fk_service_catalog
  FOREIGN KEY (service_catalog_id) REFERENCES service_catalog(id);
```

### Insert Test Data

Using the test attendee `fb9cb992-242e-41d2-98f8-cc28bf70edce` (event `5efca36a-deef-489b-be85-3dc9d1501ed7`):

1. Insert 5 service_catalog entries (transport x2, food, special, tour)
2. Insert 5 attendee_services linking the attendee to each catalog entry with the specified statuses
3. The `auto_create_service_ticket` trigger will auto-create `service_tickets` rows

## Tickets Module: Frontend

### New Files

| File | Purpose |
|---|---|
| `src/services/tickets.service.ts` | Fetch attendee services with catalog + ticket joins |
| `src/hooks/useTickets.ts` | TanStack Query hook for ticket data |
| `src/pages/attendee/Tickets.tsx` | Full Tickets page UI |
| `src/locales/es/tickets.json` | Update with all keys |
| `src/locales/en/tickets.json` | Update with all keys |

### `src/services/tickets.service.ts`

Query pattern:
```typescript
supabase.from('attendee_services')
  .select(`
    id, status, scheduled_date, scheduled_time, notes,
    service_catalog:service_catalog_id (id, name, description, service_type, valid_from, valid_until, location),
    service_tickets (id, ticket_code, qr_data, is_used, used_at)
  `)
  .eq('attendee_id', attendeeId)
```

### `src/pages/attendee/Tickets.tsx`

Layout following design spec:
- Page title + subtitle with i18n
- Summary row: two side-by-side cards showing pending/used counts with colored icons
- Filter tabs: Todos / Pendientes / Usados (active = solid #1A56A0)
- Service list: Each item with category icon in colored circle, service name, description, validity time, status badge
- Expandable: chevron tap reveals full description, QR code (via `qrcode.react`), day/time
- Empty state with ticket icon

### `src/App.tsx`

Replace the tickets `PlaceholderPage` route with the new `Tickets` component (lazy loaded).

### Locale Updates

Add keys for: `pageTitle`, `pageSubtitle`, expanded details labels, empty state text, status labels, service type labels, validity format.

## Technical Notes

- `qrcode.react` is already installed for QR rendering
- Category icon mapping: transport=Bus, food=UtensilsCrossed, special=Sparkles, tour=Map
- Category circle colors: transport=blue, food=orange, special=purple, tour=green
- Status badge: Pendiente=blue pill, Usado=gray pill
- Attendee is read-only; no mutation hooks needed for this module
- All text via i18n `tickets` namespace
