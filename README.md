# Work Deals

Cloud-synced deal pipeline recreated from the supplied reference image.

## What it does

- Matches the four-column Work Deals layout.
- Click any card to edit it.
- Drag cards between columns or reorder them.
- Double-click empty space inside a column to add a deal.
- Delete deals from the edit window.
- Saves to Supabase so the same board appears on every device.
- No login required; anyone with the site link can use/edit the board.

## 1. Create the Supabase database

1. Create a free Supabase project at https://supabase.com.
2. In Supabase, open **SQL Editor**.
3. Paste the full contents of `supabase/setup.sql` and click **Run**.
4. Go to **Project Settings → API**.
5. Copy:
   - Project URL
   - `anon` / publishable key

## 2. Run locally

```bash
npm install
cp .env.example .env
```

Open `.env` and paste your Supabase values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_KEY
```

Then:

```bash
npm run dev
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Work Deals board"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## 4. Put it online with GitHub Pages

The included GitHub Action handles deployment.

In your GitHub repo:

1. **Settings → Secrets and variables → Actions → New repository secret**
2. Add `VITE_SUPABASE_URL`
3. Add `VITE_SUPABASE_ANON_KEY`
4. Go to **Settings → Pages**
5. Set **Source** to **GitHub Actions**
6. Push to `main` or manually run the **Deploy to GitHub Pages** workflow.

Your GitHub Pages URL will then show the board and all edits will save in Supabase.

## Important security note

This project intentionally allows public read/write access because the requested behavior is “anyone who has the link.” Do not store sensitive customer information, financial information, passwords, SSNs, or private documents on this board.
