

## Plan: Add Vercel rewrite configuration

Create a `vercel.json` file at the project root with the SPA rewrite rule so all routes correctly fall back to `index.html` on Vercel hosting.

### File to create
- **`vercel.json`** — Contains the `rewrites` array redirecting all paths to `/index.html`

