

## Plan: Generate detailed sponsor documentation with app screenshots

### Summary
Create a PDF document describing the sponsor configuration functionality, including screenshots captured from the live application to illustrate each section.

### Steps

#### 1. Capture screenshots from the app
Using browser tools, navigate to and screenshot:
- Admin Sponsors list page (table view with stats cards)
- Sponsor creation/edit modal (SponsorModal form)
- Sponsor detail drawer (SponsorDetailDrawer)
- Import sponsors modal (ImportSponsorsModal)
- Attendee Commercial page (sponsor directory)
- Attendee Sponsor Detail page

#### 2. Generate PDF document
Using reportlab, create a professional PDF at `/mnt/documents/` covering:

- **Overview**: What the sponsor module does
- **Admin Panel — Sponsor Management**
  - Stats dashboard (screenshot)
  - Table with search/filter (screenshot)
  - Create/Edit form fields and validation (screenshot)
  - File specifications: logo (image/*, max 2MB), materials (PDF, max 10MB)
  - Storage paths: `event-sponsors/{event_id}/...`
- **Bulk Import via Excel**
  - Required columns: name, level, category
  - Optional columns: description, stand_location, contact_email, whatsapp, website_url, etc.
  - Supported format: .xlsx
  - Screenshot of import modal
- **Export to Excel**
  - What data is exported
- **Attendee View — Commercial Directory**
  - Category filters, level grouping, search
  - Screenshot of Commercial page
- **Attendee View — Sponsor Detail**
  - Logo, description, stand, contact links, social media, lead button
  - Screenshot of detail page
- **Lead Generation (SponsorLeadButton)**
  - How attendees share contact info with sponsors
- **Database Schema**
  - `sponsors` table columns and types
- **File Specifications Summary Table**
  - Asset type, accepted formats, max size, storage path

#### 3. QA the PDF
Convert to images, inspect every page for layout issues, fix if needed.

### Output
- `/mnt/documents/Sponsors_Configuration_Guide.pdf`

### Technical details
- Screenshots via browser tools (navigate to admin and attendee sponsor pages)
- PDF generation via reportlab with embedded screenshots
- Congress branding colors used in the document header

