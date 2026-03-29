# Poker Game UI — Design Spec

**Date:** 2026-03-28
**Branch:** Game-Adjustment
**Scope:** Rebuild the static project dashboard into a fully playable heads-up Texas Hold'em game.

---

## Overview

Replace `frontend/src/App.tsx` and its single-file static dashboard with a multi-screen interactive poker game. Add a `POST /action` backend endpoint, extend `GameStateResponse`, and augment storage to persist the live deck for mid-game state reconstruction.

---

## Architecture

### Screen State Machine

```
"welcome" → "settings" → "game"
              ↑              ↓ (Play Again)
              └──────────────┘
                (Back to Menu)
```

`App.tsx` owns `screen: Screen` and `gameState: GameState | null`. All transitions and API calls are initiated from `App` or passed down as callbacks. No router.

### Tech Stack (unchanged)
- Vite + React 18 + TypeScript + Tailwind CSS
- JetBrains Mono (monospace), DM Sans (body)
- Colors: `#000000` background, `#dc2626` red accent, `#ca8a04` gold
- All API calls to `http://localhost:8000`

---

## New Files

```
frontend/src/
  types.ts
  api.ts
  components/
    WelcomeScreen.tsx
    SettingsScreen.tsx
    GameTable.tsx
    Card.tsx
    ActionPanel.tsx
    MoveLog.tsx
```

---

## TypeScript Types (`types.ts`)

```ts
type Screen = "welcome" | "settings" | "game"
type Street = "preflop" | "flop" | "turn" | "river" | "showdown"
type Difficulty = "random" | "cheat" | "ppo"

interface GameState {
  game_id: string
  street: Street
  pot: number
  player_stack: number
  bot_stack: number
  player_hand: string[]       // e.g. ["Ah", "Kd"]
  villain_hand: string[]      // empty until showdown
  board: string[]             // up to 5 cards
  betting_history: ActionRecord[]
  to_act: string              // "hero" | "villain"
  legal_actions: string[]     // ["fold", "check", "call", "raise"]
  hero_equity: number | null  // 0.0–1.0, null at showdown
  winner: string | null       // "hero" | "villain" | "tie" | null
}

interface ActionRecord {
  player: string
  action: string
  amount?: number
}

interface MoveLogEntry {
  player: "hero" | "villain"
  action: string
  amount?: number
  pot: number
  street: Street
  equity: number | null   // hero_equity at the moment this action was taken
}

interface Settings {
  difficulty: Difficulty
  stack_size: number
  small_blind: number
  big_blind: number
  seed: string
}
```

---

## API Client (`api.ts`)

Three typed functions hitting `http://localhost:8000`:

- `startGame(settings: Settings): Promise<GameState>` — `POST /start_game`
- `getGameState(gameId: string): Promise<GameState>` — `GET /game_state/{game_id}`
- `postAction(gameId: string, action: string, amount: number | null): Promise<GameState>` — `POST /action`

---

## Screen 1 — Welcome (`WelcomeScreen.tsx`)

- Full-screen dark background, vertically centered content
- Large title: "Probabilistic Poker Engine"
- Subtitle: "Heads-Up Texas Hold'em · ML Research Platform"
- Pulsing `♠` icon with a CSS `animate-pulse` glow ring
- "Click anywhere to begin" at the bottom in slate-500
- Fade-in on mount (`opacity-0 → opacity-100`)
- Any click transitions to Screen 2

---

## Screen 2 — Settings (`SettingsScreen.tsx`)

- Centered card panel with title "Configure Your Game"
- **Difficulty**: Three toggle buttons — "Random" | "Cheat Bot" | "PPO Agent" (maps to `"random"` | `"cheat"` | `"ppo"`)
- **Starting Stack**: Three preset buttons — 500 / 1000 / 2000 (default 1000)
- **Blind Structure**: Three preset buttons — "5/10" | "10/20" | "25/50" (maps to `small_blind`/`big_blind`)
- **Seed**: Text input, placeholder "Random", optional
- **Play button**: Full-width red button, calls `api.startGame()`, shows spinner while pending, transitions to Screen 3 on success

---

## Screen 3 — Game Table (`GameTable.tsx`)

### Layout

```
┌─────────────────────────────────┬──────────────┐
│  BOT AREA                       │              │
│  "Bot" label · stack · 2× backs │  MOVE LOG    │
│─────────────────────────────────│  (sidebar,   │
│  COMMUNITY BOARD (5 slots)      │   scrollable)│
│  POT display centered           │              │
│─────────────────────────────────│              │
│  PLAYER AREA                    │              │
│  "You" label · stack · 2× faces │              │
│─────────────────────────────────│              │
│  ACTION PANEL (bottom bar)      │              │
└─────────────────────────────────┴──────────────┘
```

### Game-over state
Triggered when `winner !== null` (covers both fold endings and showdown). When `street === "showdown"`:
- Bot cards flip face-up (villain_hand revealed by backend)
- Winner banner: "You Win! +X chips" or "Bot Wins. -X chips" or "Split Pot! +0"
- Hand rank labels under each player's cards
When `winner !== null` but street is not showdown (fold):
- Bot cards stay face-down
- Winner banner shows "You Win!" or "Bot Wins." with fold notation
Two buttons always shown: "Play Again" → Screen 2, "Back to Menu" → Screen 1

---

## Card Component (`Card.tsx`)

Props: `card: string | null`, `faceDown?: boolean`

- Parses card string (e.g. `"Ah"` → rank `A`, suit `h`)
- Hearts `♥` / Diamonds `♦` in `#dc2626` red
- Spades `♠` / Clubs `♣` in `#f1f5f9` slate
- Face-down: dark back with subtle dot-grid pattern
- Deal animation: `translate-y-4 opacity-0 → translate-y-0 opacity-100` with staggered delay per card index

---

## Action Panel (`ActionPanel.tsx`)

- Street label in gold mono (e.g. "Preflop")
- Four buttons: FOLD (slate) | CHECK (slate) | CALL (slate) | RAISE (red)
- All disabled when `to_act !== "hero"` or `street === "showdown"`
- RAISE click toggles a slider row (min: big_blind, max: player_stack)
- After hero acts: buttons replaced with "Bot is thinking..." pulsing indicator for 1.2 seconds (client-side delay), then result renders

---

## Move Log (`MoveLog.tsx`)

Right sidebar, newest entry at top. Each entry shows:
- Actor chip: "YOU" (red) or "BOT" (slate)
- Action label (Fold / Check / Call / Raise X)
- Pot after action
- Street label
- Equity bar: green fill = `hero_equity × 100%`, label "X% equity"

`hero_equity` is returned per `/action` response, not stored per `betting_history` entry. The frontend accumulates a `moveLog: MoveLogEntry[]` array in local state, appending a new entry (with the equity value at that moment) on each action response. This array is separate from `betting_history`.

Empty state: "No moves yet."

---

## Backend Changes

### `backend/app/schemas/game.py` — Extend `GameStateResponse`

Add fields:
```python
to_act: str
legal_actions: list[str]
villain_hand: list[str]       # empty until showdown
hero_equity: float | None
winner: str | None
```

Extend `StartGameRequest`:
```python
difficulty: Literal["random", "cheat", "ppo"] = "random"
```

### `backend/app/routes/game.py` — Add `POST /action`

Request body schema `ActionRequest`:
```python
game_id: str
player: Literal["hero"] = "hero"
action: str
amount: int | None = None
```

Handler flow:
1. Load state dict from storage
2. Reconstruct `GameState` with live `Deck` from stored `deck_cards` key
3. Call `engine.apply_action(state, "hero", action, amount)`
4. If `state.to_act == "villain"` and `state.street != "showdown"`, apply bot action:
   - `"random"`: pick uniformly from `legal_actions(state)`, raise amount from `[big_blind, pot//2, pot]` clamped to stack
   - `"cheat"`: compute villain equity knowing both hands via MC; if > 0.6 raise, if > 0.4 call, else fold
   - `"ppo"`: use `BotAgent.act()` if checkpoint exists, else fall back to random
5. If `street == "showdown"`, determine winner via `evaluator.py`
6. Compute `hero_equity` via `engine/poker/ml/equity.py` (None at showdown)
7. Save updated state dict (with refreshed `deck_cards`) to storage
8. Return extended `GameStateResponse`

Also update `start_game` to:
- Store `difficulty` in the state dict
- Store `deck_cards` (serialized remaining cards after dealing hole cards)

Update `_to_game_state_response` to populate all new fields.

### Deck Serialization

- After `new_game()`, store `deck_cards: list[str]` in the state dict (remaining cards after dealing 4 hole cards)
- On `/action` load, reconstruct `Deck` by creating Card objects from the stored strings and setting `deck.cards`
- After each action (including bot), re-serialize `deck.cards` back to `deck_cards` in the dict before saving

---

## Error Handling

| Situation | Behavior |
|-----------|----------|
| API error on action | Toast banner; action buttons re-enable immediately |
| 404 on game_state | "Session expired" message with "New Game" button |
| PPO checkpoint missing | Silent fallback to random bot |
| Tie at showdown | "Split Pot! +0" banner |
| Fold before showdown | Winner is other player; no showdown needed |

---

## Out of Scope

- Persistent storage (database, file system)
- Multi-game history
- Authentication
- Sound effects
- Mobile layout optimization
- Animated chip stack changes
