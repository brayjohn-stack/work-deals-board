# Work Deals

Cloud-synced deal board using React/Vite + Supabase.

## Important update
This version fixes Supabase URLs that were copied with `/rest/v1/`, surfaces the real database error, explicitly grants browser access to the `deals` table, and adds a restorable Archive for Completed and Trash deals.

## Supabase
Run `supabase/setup.sql` in the Supabase SQL Editor. It is safe to run again on an existing project and migrates the existing `deals` table.

## Environment
Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

The app also normalizes a URL ending in `/rest/v1/` if one was pasted by mistake.

## Local

```bash
npm install
npm run dev
```

## GitHub Pages
Repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The included GitHub Actions workflow builds and deploys on pushes to `main`.
