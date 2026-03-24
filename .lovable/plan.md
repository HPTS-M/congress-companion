

## Plan: Fix logo on Index page and remaining "CONGRÉSSAPP" in tab title

Two issues found:

### 1. Browser tab still shows "CONGRÉSSAPP"
**File: `index.html`** — Lines 6, 19, 20 still contain "CONGRÉSSAPP — Health Plus Travels". These were missed in the previous replacement pass.

- Line 6: `<title>` → "Health Plus Travels Events"
- Line 19: `og:title` → "Health Plus Travels Events"
- Line 20: `twitter:title` → "Health Plus Travels Events"

### 2. Index page still shows "C" icon instead of logo
**File: `src/pages/Index.tsx`** — Lines 27-34 render a gradient square with a hardcoded "C" letter. Replace this block with the logo image:

```tsx
<img src="/logo-250px.png" alt="Logo" className="mx-auto mb-8 h-20 w-auto" />
```

### Files to modify
- `index.html` (3 lines)
- `src/pages/Index.tsx` (replace gradient div with img tag)

