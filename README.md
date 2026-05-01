<p align="center">
  <img src="assets/logo.jpeg" alt="Bhaiya Radar" width="120" style="border-radius: 16px">
</p>

<h1 align="center">Bhaiya Radar</h1>

<p align="center"><em>Spot him. Snap him. Climb the leaderboard.</em></p>

---

A gamified photo-spotting leaderboard where players compete by uploading photos of a designated subject. Rankings are determined by upload count, frequency, and community upvotes.

## ✨ Features

- **Leaderboard** — Real-time rankings weighted by photos uploaded, upload consistency, and upvotes received
- **Gallery** — Instagram-style 4-column grid with lightbox viewer, comments, replies, and per-photo likes
- **Photo Upload** — Drag-and-drop with client-side compression to stay within Supabase free tier limits
- **Authentication** — Email/password sign-up and sign-in via Supabase Auth
- **Glassmorphism Design** — Apple-inspired frosted glass UI with light color scheme
- **Dark Mode** — Toggle between light and dark themes, persisted via localStorage
- **Fully Responsive** — Fluid `clamp()`-based sizing adapts to any screen resolution

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Backend / DB** | [Supabase](https://supabase.com) (Postgres, Auth, Storage) |
| **Hosting** | [GitHub Pages](https://pages.github.com) |
| **CI/CD** | GitHub Actions (deploy on push, keep-alive ping to prevent Supabase pausing) |

## 📁 Project Structure

```
├── index.html              # Leaderboard + auth page
├── upload.html             # Photo upload page
├── gallery.html            # Photo gallery with lightbox
├── css/
│   └── style.css           # All styles (glassmorphism, fluid responsive)
├── js/
│   ├── supabase-client.js  # Supabase connection config
│   ├── auth.js             # Auth logic + UI management
│   ├── leaderboard.js      # Rankings fetch + render
│   ├── upload.js           # Upload + image compression
│   └── gallery.js          # Gallery grid, lightbox, comments, votes
├── schema.sql              # Database schema + RLS policies
├── assets/
│   └── logo.jpeg           # Brand icon
└── .github/workflows/
    ├── deploy.yml          # GitHub Pages deployment
    └── keep-alive.yml      # Supabase inactivity prevention
```

## 🚀 Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Run `schema.sql`** in the Supabase SQL Editor to create tables and RLS policies

3. **Create a storage bucket** named `submissions` (set to public) in the Supabase dashboard

4. **Configure Supabase Auth** — set Site URL to your GitHub Pages domain

5. **Update credentials** in `js/supabase-client.js`:
   ```js
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

6. **Add GitHub Secrets** in your repo settings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

7. **Push to `main`** — GitHub Actions deploys to Pages and the keep-alive cron activates

## 📊 Scoring Formula

Leaderboard rank is computed over a rolling 30-day window:

```
Score = (photos × 0.4) + (active_days × 0.2 × 10) + (upvotes_from_others × 0.4)
```

- **Photos**: Total submissions in the last 30 days
- **Active Days**: Number of distinct days with at least one upload
- **Upvotes**: Only votes from *other users* count toward ranking

## 📄 License

MIT
