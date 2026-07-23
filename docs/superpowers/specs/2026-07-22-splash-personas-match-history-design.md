# Splash screen, persona cards, and Report Card match history — design

**Date:** 2026-07-22
**Status:** approved by user (conversation), pending spec review

## Goal

Three UI-focused changes to the Midnight Casino poker trainer:

1. A minimal, polished **splash screen** shown before the coach dashboard.
2. The coach dashboard's persona dropdown replaced with four **selectable persona cards** carrying play-style descriptions.
3. The **Report Card restructured** into Overview + Match History tabs, where past sessions can be browsed and their hands replayed.

All work stays within the existing Midnight Casino design language (theme.css tokens: felt greens, gold, cream, Palatino display face). No backend or database schema changes.

## Decision: derived sessions (no schema change)

Hands are already stored individually in IndexedDB (`HandRecord`: ts, mode, personaKey, drill, heroNet, full replayable state, graded decisions). Sessions are **derived at read time**, not stored:

- New pure function `groupSessions(records: HandRecord[]): SessionSummary[]` in `app/src/profile/`.
- Sort by `ts`; start a new session whenever persona or mode changes, or the gap between consecutive hands exceeds 30 minutes (`SESSION_GAP_MS = 30 * 60_000`).
- Drill hands (`drill !== null`) form their own sessions, labeled as drills, so they never pollute match/training results.
- `SessionSummary`: `{ start, end, mode, personaKey, drill: string | null, handCount, netChips, netBB, accuracy, mistakes, handIds }`.

Rationale: zero migration, works retroactively on all existing hands, purely read-side and trivially unit-testable. Known trade-off (accepted): boundaries are heuristic — two back-to-back sessions against the same persona within 30 minutes merge into one. Explicit session ids (schema bump) can be added later without wasted work if exact boundaries ever matter.

## 1. Splash screen

New `Splash` component; `App.tsx` screen state gains a `'splash'` value and starts there: `splash → home → report/game`.

- **Visual:** full-viewport near-black room, slow gold vignette. Centered: the game title large in the display face with the "Midnight Casino" flourish, an oversized playing-card motif (reusing existing card styles) that deals in on load, one gold **"Enter the Casino"** button, and the tagline *"A poker trainer that learns your leaks."* Nothing else.
- **Behavior:** Enter button (min 44px, glow hover, visible focus ring) goes to the dashboard; clicking anywhere on the screen also enters. Shows on every fresh page load — no persistence.
- **Motion:** title fades up, card uses the existing `deal-in` keyframes; all animation disabled under `prefers-reduced-motion`.

## 2. Coach dashboard — persona cards

The dashboard keeps its current structure (header, stats strip, felt coach card, Next focus / Graduated sections, play-controls rail). One change: the persona `<select>` in the rail is replaced by a **2×2 grid of selectable persona cards** (single column under 480px).

Each card shows:

- Persona name in the display face plus a suit-pip crest: Nit = spade, Maniac = heart, Calling Station = club, Balanced Player = diamond.
- A two-line play-style description written from the actual `PersonaParams` (preflopRange, aggression, callDown, bluffFreq, foldToRaise) so copy matches real bot behavior. Draft copy (final wording at implementation):
  - **The Nit** — "Plays only premium hands and folds under pressure. Steal his blinds relentlessly — but when he raises, believe him."
  - **The Maniac** — "Raises with almost anything and never slows down. Tighten up, call down with real hands, and let him hang himself."
  - **The Calling Station** — "Calls everything, folds nothing, rarely raises. Value-bet thin and never bluff — he's paying you off."
  - **The Balanced Player** — "Solid, aggressive in the right spots, hard to exploit. Play fundamentally sound poker to beat him."
- Three compact trait meters derived from `PersonaParams`: **Looseness** (preflopRange), **Aggression** (aggression), **Stubbornness** (`1 - foldToRaise`).

Selection: an accessible radiogroup (real radio inputs, arrow keys + click, `focus-within` ring). Selected card lifts with a gold inlay border; unselected cards stay dim. Default remains `balanced`. Training/Match toggle and Deal In unchanged.

Test impact: `CoachFeed.test.tsx` case (d) switches from `getByLabelText(/persona/i)` + change event to clicking a card radio; assertions on `onPlay`/`onDrill` payloads unchanged.

## 3. Report Card — Overview + Match History

Two-tab screen; tabs styled like the dashboard's segmented gold pill.

**Overview tab** — existing content restyled to the felt-and-gold treatment:
- Stat tiles: tabular mono numerals, panel/hairline styling consistent with the dashboard stat strip.
- Trend chart: gold gradient fill under the line, minimal axis context (start/end hand counts, 100% line).
- Leak table: row hover states, existing hand links unchanged.

**Match history tab** — reverse-chronological list of `SessionSummary` rows:
- Row: date ("Jul 20, 9:14 PM"), persona pip + name, mode badge (Training / Match / Drill), hands played, net result as a signed chip figure colored green (`--good`) / red (`--red-soft`), accuracy %.
- Clicking a row expands it inline (accordion — no new screen): the session's hands listed with hand #, hero net chips, mistake count; each hand opens in the existing Replay Theater via the existing `onOpenHand` callback.
- Only one row expanded at a time. Rows are buttons (44px+ targets, focus rings).

**Empty states:** both tabs show a friendly "Play your first session…" invitation when there's no data.

**Wiring:** `App.tsx` already holds the raw records for the coach; it additionally passes `records: HandRecord[]` to `ReportCard`, which calls `groupSessions` itself. `stats`, `onBack`, `onOpenHand` props unchanged.

## Error handling

- No new failure modes: all data is already-loaded in-memory records. `groupSessions([])` returns `[]`; UI shows empty states.
- Non-persistent storage (memory fallback) behaves identically — history simply spans the current visit; the existing storage warning banner already communicates this.

## Testing

- **Unit:** `groupSessions` — splits on time gap, persona change, mode change; drill separation; netChips/netBB/accuracy math; empty input.
- **Component:** Splash (enter callback, render), CoachFeed persona-card selection (radiogroup semantics, onPlay/onDrill payloads), ReportCard (tab switching, session row expand/collapse, replay-open callback, empty states).
- **E2E:** extend the existing Playwright smoke to click through splash → dashboard → report card → match history tab.
- Visual QA via screenshots at 1280px and 375px, light on motion (`prefers-reduced-motion` spot check).

## Out of scope

- Persisted session ids / schema changes (approach B) — deferred until exact boundaries matter.
- Splash "show once" persistence.
- Any changes to the game screen, grading, or engine.
