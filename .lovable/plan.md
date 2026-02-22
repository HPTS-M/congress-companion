
# Add Pre-filled WhatsApp Message to Sponsor Contact

## 1. Database Migration

Add one new nullable column to `sponsors`:

```sql
ALTER TABLE sponsors ADD COLUMN whatsapp_message text;
```

Then update the Vitalis test sponsor with the custom message:

```sql
UPDATE sponsors 
SET whatsapp_message = 'Hola, los visite en el XIII Congreso de Farmacia Hospitalaria y me gustaria obtener mas informacion sobre sus soluciones.'
WHERE name = 'Vitalis Pharmaceuticals';
```

## 2. Update Service Interface

In `src/services/sponsors.service.ts`, add to the `Sponsor` interface:

```
whatsapp_message: string | null;
```

## 3. Update SponsorDetail.tsx

- Import `useEvent` from `@/hooks/useEvent`
- Get event data: `const { event } = useEvent();`
- Build WhatsApp URL with encoded message:

```typescript
const message = sponsor.whatsapp_message || 
  `Hola, te contacto desde el ${event?.name ?? ''}. Me interesa conocer mas sobre ${sponsor.name}.`;
const url = `https://wa.me/${sponsor.whatsapp}?text=${encodeURIComponent(message)}`;
```

- Update the WhatsApp button `onClick` to use this URL instead of the plain `https://wa.me/` link.

## 4. Files Changed

| File | Change |
|---|---|
| New migration | Add `whatsapp_message` column + update Vitalis test data |
| `src/services/sponsors.service.ts` | Add `whatsapp_message` to interface |
| `src/pages/attendee/SponsorDetail.tsx` | Import `useEvent`, build WhatsApp URL with pre-filled message |

No locale changes needed -- the message is data-driven, not an i18n key.
