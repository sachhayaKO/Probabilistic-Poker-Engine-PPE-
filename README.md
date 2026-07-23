# Probabilistic Poker Engine (PPE)

A heads-up No-Limit Hold'em poker coach that runs entirely in the browser. Play hands against opponent personas, get every decision graded against an equity-based baseline in real time, and review your leaks in a visual report card — no backend, no account, no data leaves your machine.

## Features

- **Splash gate** — boot into the casino with an animated ghost table before entering the coach dashboard.
- **Coach Feed** — a felt-styled dashboard that names your biggest leak from recent play and suggests what to drill next.
- **Opponent personas** — selectable persona cards with play-style blurbs and trait meters:
  - *The Nit* — tight and cautious
  - *The Maniac* — hyper-aggressive
  - *The Calling Station* — never folds
  - *The Balanced Player* — solid all-around baseline
- **Graded play** — every action you take is reviewed by the grading engine; a ribbon shows verdicts and EV deltas hand by hand.
- **Report Card** — tabbed review panel with an accuracy ring, verdict chips, EV bars, and a session timeline.
- **Match history** — sessions are derived from your hand records and can be drilled into and replayed.

## Running locally

Requires Node 18+.

```bash
cd app
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Scripts

All scripts run from the `app/` directory:

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Project structure

```
app/
  src/
    engine/    # Cards, hand evaluation, equity — the poker engine
    personas/  # Opponent persona definitions and decision logic
    grading/   # Decision grading against the equity baseline
    profile/   # Hand records, session grouping, match history
    worker/    # Web worker for off-main-thread computation
    ui/        # React components: Splash, CoachFeed, ReportCard, Ribbon, table UI
  e2e/         # Playwright end-to-end specs
docs/          # Design specs and implementation plans
```

## Stack

React 19 · TypeScript · Vite · Vitest · Playwright · oxlint

Everything is computed client-side; the deployed app is a static site (published to GitHub Pages via `.github/workflows/deploy.yml`).

## License

See [LICENSE](LICENSE).
