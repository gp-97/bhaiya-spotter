<p align="center">
  <img src="assets/logo.jpeg" alt="Bhaiya Radar" width="120" style="border-radius: 16px;">
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
## 📄 License

MIT
