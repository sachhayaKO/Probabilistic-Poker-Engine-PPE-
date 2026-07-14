# PPE Rebuild — Heads-Up Poker Trainer

**Date:** 2026-07-13
**Status:** Approved design

## What this is

A ground-up rebuild of the Probabilistic Poker Engine as a single-player, desktop-first web app: heads-up No-Limit Hold'em against personality bots, where every decision is graded post-hoc against equity/pot-odds math and aggregated into a long-term leak profile that actively coaches the player. The existing Python/FastAPI/PPO stack is retired, not ported.

## Goals

- Make the player measurably better at heads-up NLHE.
- Feedback model: **post-decision correction** (chess-engine-review style), never live hints during a hand.
- A beautiful, highly interactive UI the player wants to open daily.

## Non-goals

- Multiplayer, networking, or accounts.
- GTO solver integration (v1 grades on equity/pot-odds math + preflop charts).
- Porting the PPO neural agent.
- Mobile-specific design (basic responsiveness only).

## Game modes

Both modes share one engine and are fully graded:

1. **Training** — stacks reset to 100BB every hand. Clean, comparable grading; the default grind mode.
2. **Match** — persistent stacks, play a heads-up match until someone busts.

## The teaching loop

1. **Play the hand cold.** No equity, odds, or hints shown while a hand is live.
2. **End-of-hand review (default): the Side Ribbon.** A persistent panel beside the table fills in when the hand ends: each street's decision graded (✓ best / ~ okay / ✗ mistake with EV lost), plus running session stats (accuracy %, EV lost). The table never leaves the screen; one keypress deals the next hand.
3. **Deep dive (optional): the Replay Theater.** Any hand opens into a scrubber: step to each decision point, see comparative EV bars for every available action (fold/call/raise), replay the villain's actions. Each decision includes a **written explanation with the actual equations**, numbers plugged in, e.g.:
   > Pot was 1,000 and the call was 400, so you needed 400 / (1,000 + 400 + 400) = 22% equity to call. Against the Maniac's range here your hand had ~19%. Folding was best; the call loses 180 chips on average.
4. **Persistence.** Every graded decision is stored (IndexedDB) with its context tags (street, action-facing, hand class, persona) for aggregation.

## The training system

- **Coach Feed (front page).** Opinionated: names the player's single biggest leak in plain English, shows the evidence (EV lost, count, links to offending hands), and offers **Drill This Spot** — targeted scenarios of that leak's pattern dealt repeatedly until accuracy in that category recovers. Includes graduation/streak mechanics ("preflop raising: graduated at 92% over 200 hands") and a next-focus queue.
- **Report Card (one level below).** Full stats dashboard: accuracy trend over time, bb lost/100, hands graded, ranked leak list by EV lost, per-category breakdowns.
- **Drills** are generated situations matching a leak's pattern (e.g. "facing a large river bet holding a bluff-catcher"), not literal replays of past hands.
- **Build order:** stats/aggregation engine and Report Card first; Coach Feed and drills stack on top of the same data.

## The grading brain

- **Postflop:** Monte Carlo equity vs. **the bot persona's modeled range** (not two random cards — random-hand equity would systematically mis-grade). Decision graded by comparing equity to required equity from pot odds; EV lost computed per mistake.
- **Preflop:** graded against standard heads-up charts (open/limp/3-bet ranges), where correctness is well established, rather than raw equity.
- **Bet sizing:** v1 grades the *action choice* (fold/call/raise). Sizing is flagged only when egregious (e.g. min-raise with the nuts). Fine-grained sizing grades are out of scope for v1.
- Runs in a Web Worker; grading a full hand should complete within ~1s of hand end.

## The opponents

Personality bots defined by explicit, tunable parameters (range width, aggression, call-down tendency, bluff frequency):

- **The Nit** — far too tight.
- **The Maniac** — over-aggressive, bluff-heavy.
- **The Calling Station** — never folds, rarely raises.
- **The Balanced Player** — solid all-around default.

The same persona parameter definitions drive both the bot's play **and** the range model used to grade the player — one source of truth.

## Architecture

- **Pure frontend, no backend.** One React + TypeScript app.
- **Web Worker:** poker engine simulation-side work — Monte Carlo equity, range evaluation, grading. UI thread never stutters.
- **IndexedDB:** hand history, graded decisions, leak aggregates, settings.
- **Deploy:** static site.
- Suggested module boundaries (each independently testable):
  - `engine/` — pure game rules: dealing, betting legality, hand evaluation, pot resolution. No UI, no randomness policy.
  - `personas/` — bot decision-making + range models, parameterized.
  - `grading/` — equity sims, preflop charts, decision grading, EV-lost math.
  - `profile/` — decision store, leak aggregation, drill selection.
  - `ui/` — table, ribbon, replay theater, coach feed, dashboard.

## Look & feel

- **Visual direction: Midnight Casino.** Dark luxe — deep felt greens over near-black, gold trim, serif display type, cinematic vignette lighting.
- **Full motion design:** cards dealt with arc and easing, chips sliding/stacking into the pot, pot pushed to the winner, board cards flipping.
- **Sound design (toggleable):** card slides, chip clinks, subtle stings on big pots and on mistakes surfaced in review.
- **Dramatic reveals:** all-in showdowns run out slow with a live equity race graphic as each card lands.
- **Keyboard-speed play:** F/C/R hotkeys, bet-size presets (33/50/75/pot), instant next-hand. Volume grinding never fights the polish.
- **Desktop-first**; basic responsiveness only.

## Testing

- `engine/` and `grading/` are pure functions — exhaustive unit tests (hand evaluation against known rankings, betting-rule edge cases, equity sims against published benchmark spots, EV math).
- `personas/` — statistical tests (a Nit's VPIP lands in its configured band over N simulated hands).
- `profile/` — aggregation unit tests on synthetic decision streams.
- UI — component tests for the review flow; Playwright smoke test for a full hand → review → replay cycle.

## Error handling

- Web Worker failure: grading degrades gracefully (hand playable ungraded, retry on next hand) rather than blocking play.
- IndexedDB unavailable: session-only mode with a visible warning that progress isn't being saved.

## Decisions log

| Question | Decision |
|---|---|
| Teaching mechanic | Post-decision feedback (not live coach, not drills-first) |
| Grading ground truth | Equity + pot-odds math; preflop charts preflop |
| Opponent design | Personality bots (nit/maniac/station/balanced) |
| Feedback timing | End of each hand |
| Progress tracking | Full leak profile, persistent |
| Stakes model | Both: Training (100BB reset) + Match (to the felt) |
| Review UX | Side ribbon default + Replay Theater deep dive with equations |
| Leak profile UX | Coach Feed front page + Report Card below |
| Architecture | Pure frontend (React+TS, Web Worker, IndexedDB) |
| Visual direction | Midnight Casino |
| Platform | Desktop-first |
| Polish | Full motion + sound + dramatic reveals + hotkeys |
| Bet sizing grades | Action-level only in v1; flag egregious sizing |
| Drill content | Generated pattern-matched scenarios, not literal replays |
