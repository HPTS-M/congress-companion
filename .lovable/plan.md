
# Documents Module

## Overview
Build the Documents page at `/:eventSlug/documents` showing event documents with filter tabs, download via signed URLs, and test data insertion.

## Database Changes

### 1. Grant SELECT on `documents` table
Same issue as `attendees` -- no table-level SELECT privilege for `authenticated`/`anon`.

```sql
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT ON public.documents TO anon;
```

### 2. Insert 4 test documents
Using event_id `5efca36a-deef-489b-be85-3dc9d1501ed7` and linking to real sessions:
- "Capítulo Oncología..." = `ecf95cd6-ca59-4999-ae71-e7033df99c21`
- "Implementación de programas de uso racional de opioides" = `5c39d6f2-037d-4ee6-a360-d4c167f08aca`

```sql
INSERT INTO documents (event_id, title, file_type, file_path, session_id) VALUES
  ('5efca36a-...', 'Programa Académico XIII Congreso', 'pdf', 'event-documents/5efca36a-.../programa-academico.pdf', NULL),
  ('5efca36a-...', 'Farmacología Oncológica Avanzada', 'pptx', 'event-documents/5efca36a-.../farmacologia-oncologica.pptx', 'ecf95cd6-...'),
  ('5efca36a-...', 'Guía de Uso Racional de Opioides', 'pdf', 'event-documents/5efca36a-.../guia-opioides.pdf', '5c39d6f2-...'),
  ('5efca36a-...', 'Abstract Book - XIII Congreso ACQFH', 'pdf', 'event-documents/5efca36a-.../abstract-book.pdf', NULL);
```

## New Files

### `src/locales/es/documents.json` and `src/locales/en/documents.json`
i18n keys for:
- title, subtitle
- filter tabs: all, presentations, abstracts, guides
- empty state, general label, download error toast, file size units

### `src/services/documents.service.ts`
- `getByEvent(eventId)` -- fetches documents with joined session title from `event_activities`
- `getSignedUrl(filePath)` -- creates a 1-hour signed URL from Supabase Storage

### `src/hooks/useDocuments.ts`
- TanStack Query hook wrapping `documentsService.getByEvent`

### `src/pages/attendee/Documents.tsx`
Full page with:
- Header: title + subtitle
- Filter tabs (Todos / Presentaciones / Abstracts / Guias) -- active tab styled with `#1A56A0` bg, white text
- Document cards: file-type icon in colored circle (red=pdf, orange=pptx, blue=docx, green=xlsx), title, session name or "General", file size
- Download button: calls `getSignedUrl`, opens in new tab, shows error toast if file missing
- Empty state
- Loading skeleton

## Modified Files

### `src/lib/i18n.ts`
Add `documents` namespace imports for both ES and EN.

### `src/App.tsx`
Replace `PlaceholderPage` for the documents route with the new `Documents` component (lazy loaded).

## Technical Details

### Filter Logic
- "Todos": show all
- "Presentaciones": `file_type === 'pptx'`
- "Abstracts": title contains "abstract" (case-insensitive)
- "Guias": title contains "guía" or "guia" (case-insensitive)

### File Type Icon Config
| Type | Color | Icon |
|------|-------|------|
| pdf | red-500 circle | FileText |
| pptx | orange-500 circle | Presentation |
| docx | blue-500 circle | FileText |
| xlsx | green-500 circle | Sheet |

### Signed URL Flow
1. User taps download icon
2. Call `supabase.storage.from('event-documents').createSignedUrl(path, 3600)`
3. On success: `window.open(url, '_blank')`
4. On error: show toast with error message (files don't exist yet, expected)
