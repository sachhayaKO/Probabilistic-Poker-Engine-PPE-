# PPE Dashboard

Live-updating project dashboard for the **Probabilistic Poker Engine** — a heads-up Texas Hold'em ML research platform.

## Stack

- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS 3** for styling
- **Recharts** for data visualization
- **Lucide React** for icons

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview   # preview the production build locally
```

## Deploy to GitHub Pages

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`). Every push to `main` builds the frontend and publishes the `dist/` directory to GitHub Pages.

**Backend URL configuration**

The frontend reads the API base URL from the `VITE_API_BASE_URL` environment variable at build time.

- **Local development**: copy `.env.example` to `.env.local` — it defaults to `http://localhost:8000`.
- **Hosted backend**: add `VITE_API_BASE_URL` as a GitHub Actions secret (`Settings → Secrets and variables → Actions`) pointing at your deployed backend. If the secret is not set, the build falls back to `http://localhost:8000`, which means the hosted frontend will only work when the user also has the backend running locally.

```bash
# .env.local (not committed)
VITE_API_BASE_URL=https://your-backend.example.com
```
