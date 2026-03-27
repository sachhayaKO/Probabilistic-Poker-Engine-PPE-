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

1. In `vite.config.ts`, set the `base` option to match your repo name:
   ```ts
   base: '/Probabilistic-Poker-Engine-PPE-/'
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Push the `dist/` folder to the `gh-pages` branch, or use the `gh-pages` npm package:
   ```bash
   npx gh-pages -d dist
   ```

## Dashboard Sections

| Section | Description |
|---------|-------------|
| Hero Stats | Sprint progress, test count, API endpoints, ML component status |
| Milestone Tracker | Week 1 checklist with progress bar |
| Architecture Overview | Component map with arrows |
| API Endpoints | Live endpoint cards with example responses |
| ML Pipeline Status | Per-component status badges |
| Test Coverage | File-level breakdown with bar chart |
| Tech Stack Footer | Language/framework badges |
