

# Fix .env Security Warning

## Changes

### 1. Update `.gitignore` — Add environment file exclusions

Add the following lines after the existing `*.local` entry:

```
# Environment files
.env
.env.local
.env.*.local
!.env.example
```

### 2. Update `.env.example` — Replace with correct placeholder variables

Replace current contents with:

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_DEV_MODE=false
VITE_VAPID_PUBLIC_KEY=your_vapid_key_here
```

No real keys, just descriptive placeholders.

### 3. Post-fix

Run security scan to confirm 0 errors and 0 warnings. If clean, Phase 3 is complete and we proceed to Phase 4 (Agenda page).

---

### Notes

- The `.env` file with real Supabase keys currently exists in the repo. Adding it to `.gitignore` prevents future commits but does not remove it from git history. Removing from history requires `git filter-branch` or BFG Repo Cleaner, which is outside Lovable's scope. The keys are the public anon key (safe to expose) so this is low risk.
- The `VITE_SUPABASE_PUBLISHABLE_KEY` variable in the current `.env` will be renamed to `VITE_SUPABASE_ANON_KEY` in the example to match project guidelines.

