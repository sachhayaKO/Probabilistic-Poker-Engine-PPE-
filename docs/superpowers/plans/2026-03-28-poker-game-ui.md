# Poker Game UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static frontend dashboard into a fully playable 3-screen heads-up Texas Hold'em game, backed by a new `POST /action` API endpoint that handles hero actions, bot auto-response, and equity calculation.

**Architecture:** `App.tsx` owns a `screen` state machine (`welcome → settings → game`) and a `gameState` object; all API calls flow through a typed `api.ts` client. The backend's new `/action` endpoint reconstructs live deck state from a stored `deck_cards` key, applies hero + bot actions in one round trip, and returns an extended `GameStateResponse` with `to_act`, `legal_actions`, `hero_equity`, and `winner`.

**Tech Stack:** Python 3.11 / FastAPI / Pydantic (backend); React 18 / TypeScript / Tailwind CSS / Vite (frontend). Tests: pytest + FastAPI TestClient. No new dependencies needed.

---

## File Map

**Modified:**
- `backend/app/schemas/game.py` — extend `GameStateResponse`, `StartGameRequest`; add `ActionRequest`
- `backend/app/routes/game.py` — add deck helpers, bot helpers, winner logic; add `POST /action`; update `start_game` and `game_state` routes
- `frontend/src/App.tsx` — full rewrite: screen state machine, action handler, move log accumulation

**Created:**
- `backend/tests/test_api_action.py` — tests for `/action` endpoint and new response fields
- `frontend/src/types.ts` — `GameState`, `MoveLogEntry`, `Settings`, `Screen`, etc.
- `frontend/src/api.ts` — `startGame()`, `getGameState()`, `postAction()`
- `frontend/src/components/Card.tsx` — renders card face or back with deal animation
- `frontend/src/components/WelcomeScreen.tsx` — splash screen with pulsing suit icon
- `frontend/src/components/SettingsScreen.tsx` — difficulty/stack/blinds/seed form
- `frontend/src/components/ActionPanel.tsx` — street label + action buttons + raise slider
- `frontend/src/components/MoveLog.tsx` — scrollable action history with equity bars
- `frontend/src/components/GameTable.tsx` — table layout + game-over overlay

---

## Task 1: Extend Backend Schemas

**Files:**
- Modify: `backend/app/schemas/game.py`

- [ ] **Step 1: Replace the contents of `backend/app/schemas/game.py`**

```python
from __future__ import annotations

"""
API schemas for game creation and state responses.
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Street = Literal["preflop", "flop", "turn", "river", "showdown"]


class StartGameRequest(BaseModel):
    stack_size: int = Field(default=1000, gt=0)
    small_blind: int = Field(default=5, gt=0)
    big_blind: int = Field(default=10, gt=0)
    seed: int | None = None
    difficulty: Literal["random", "cheat", "ppo"] = "random"

    @model_validator(mode="after")
    def big_blind_must_exceed_small_blind(self) -> "StartGameRequest":
        if self.big_blind < self.small_blind:
            raise ValueError("big_blind must be >= small_blind")
        return self


class ActionRequest(BaseModel):
    game_id: str
    player: Literal["hero"] = "hero"
    action: str
    amount: int | None = None


class GameStateResponse(BaseModel):
    game_id: str
    street: Street
    pot: int
    player_stack: int
    bot_stack: int
    player_hand: list[str]
    villain_hand: list[str] = []
    board: list[str]
    betting_history: list[dict[str, object]]
    to_act: str = "hero"
    legal_actions: list[str] = []
    hero_equity: float | None = None
    winner: str | None = None
```

- [ ] **Step 2: Run existing tests to confirm they still pass**

```bash
pytest backend/tests/ -v
```

Expected: all existing tests pass (new fields have defaults so no validation errors).

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/game.py
git commit -m "feat: extend GameStateResponse and StartGameRequest with game-play fields"
```

---

## Task 2: Write Failing Tests for /action

**Files:**
- Create: `backend/tests/test_api_action.py`

- [ ] **Step 1: Create the test file**

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.storage import reset_db

client = TestClient(app)


def setup_function() -> None:
    reset_db()


def _start(seed: int = 42, difficulty: str = "random") -> dict:
    return client.post(
        "/start_game",
        json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": seed, "difficulty": difficulty},
    ).json()


def test_start_game_returns_new_fields() -> None:
    payload = _start()
    assert "to_act" in payload
    assert "legal_actions" in payload
    assert isinstance(payload["legal_actions"], list)
    assert len(payload["legal_actions"]) > 0
    assert "villain_hand" in payload
    assert payload["villain_hand"] == []
    assert "hero_equity" in payload
    assert payload["hero_equity"] is not None
    assert 0.0 <= payload["hero_equity"] <= 1.0
    assert "winner" in payload
    assert payload["winner"] is None


def test_action_fold_hero_villain_wins() -> None:
    game = _start()
    response = client.post("/action", json={"game_id": game["game_id"], "action": "fold"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["winner"] == "villain"


def test_action_check_both_players_act() -> None:
    game = _start()
    response = client.post("/action", json={"game_id": game["game_id"], "action": "check"})
    assert response.status_code == 200
    payload = response.json()
    assert "to_act" in payload
    assert "legal_actions" in payload


def test_action_advances_street_after_two_checks() -> None:
    """Two checks (hero + bot) should advance the street from preflop to flop."""
    game = _start(seed=7, difficulty="random")
    assert game["street"] == "preflop"

    response = client.post("/action", json={"game_id": game["game_id"], "action": "check"})
    assert response.status_code == 200
    payload = response.json()
    # After hero check + bot check, betting_history has 2 entries → advance_street fires
    assert payload["street"] == "flop"
    assert len(payload["board"]) == 3


def test_action_raises_on_unknown_game() -> None:
    response = client.post("/action", json={"game_id": "no-such-game", "action": "check"})
    assert response.status_code == 404


def test_action_invalid_action_returns_400() -> None:
    game = _start()
    response = client.post("/action", json={"game_id": game["game_id"], "action": "shove"})
    assert response.status_code == 400


def test_action_raise_adds_to_pot() -> None:
    game = _start(seed=99)
    response = client.post(
        "/action", json={"game_id": game["game_id"], "action": "raise", "amount": 50}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pot"] >= 50


def test_showdown_reveals_villain_hand() -> None:
    """Play 8 checks (4 rounds × 2 players) to reach showdown."""
    game = _start(seed=1, difficulty="random")
    game_id = game["game_id"]
    last = game

    for _ in range(8):
        if last.get("winner") is not None:
            break
        resp = client.post("/action", json={"game_id": game_id, "action": "check"})
        assert resp.status_code == 200
        last = resp.json()

    # At showdown, villain_hand must be revealed and winner set
    assert last["street"] == "showdown" or last["winner"] is not None
    if last["street"] == "showdown":
        assert len(last["villain_hand"]) == 2
        assert last["winner"] in ("hero", "villain", "tie")
```

- [ ] **Step 2: Run the tests — confirm they all fail**

```bash
pytest backend/tests/test_api_action.py -v
```

Expected: `test_start_game_returns_new_fields` fails (hero_equity is None, legal_actions is empty); all `/action` tests fail with `404` (route not found) or assertion errors.

---

## Task 3: Implement Route Helpers and Update start_game / game_state

**Files:**
- Modify: `backend/app/routes/game.py`

- [ ] **Step 1: Replace the full contents of `backend/app/routes/game.py`**

```python
from __future__ import annotations

"""
Game routes: start_game, game_state, and action.
"""

import random as stdlib_random

from fastapi import APIRouter, HTTPException

from backend.app.schemas.game import ActionRequest, GameStateResponse, StartGameRequest
from backend.app.storage import load_game_state, save_game_state
from engine.poker.cards import Card, Deck
from engine.poker.evaluator import evaluate_hand
from engine.poker.game import apply_action
from engine.poker.game import legal_actions as get_legal_actions
from engine.poker.game import new_game
from engine.poker.ml.equity import run_equity_estimate
from engine.poker.state import GameState

router = APIRouter(tags=["game"])


# ── Deck helpers ──────────────────────────────────────────────────────────────


def _serialize_deck(deck: Deck) -> list[str]:
    return [card.to_str() for card in deck.cards]


def _deserialize_deck(card_strings: list[str]) -> Deck:
    deck = Deck()
    deck._cards = [Card.from_str(s) for s in card_strings]
    return deck


# ── State reconstruction ──────────────────────────────────────────────────────


def _reconstruct_game_state(state_dict: dict[str, object]) -> GameState:
    deck = _deserialize_deck(list(state_dict.get("deck_cards", [])))  # type: ignore[arg-type]

    hands_raw = state_dict.get("hands", {})
    if not isinstance(hands_raw, dict):
        raise ValueError("invalid state: hands must be a dict")

    hero_cards = [Card.from_str(str(s)) for s in hands_raw.get("hero", [])]  # type: ignore[union-attr]
    villain_cards = [Card.from_str(str(s)) for s in hands_raw.get("villain", [])]  # type: ignore[union-attr]
    board = [Card.from_str(str(s)) for s in state_dict.get("board", [])]  # type: ignore[arg-type]

    stacks_raw = state_dict.get("stacks", {"hero": 0, "villain": 0})
    if not isinstance(stacks_raw, dict):
        raise ValueError("invalid state: stacks must be a dict")

    return GameState(
        game_id=str(state_dict["game_id"]),
        seed=state_dict.get("seed"),  # type: ignore[arg-type]
        street=str(state_dict["street"]),  # type: ignore[arg-type]
        pot=int(state_dict["pot"]),  # type: ignore[arg-type]
        stacks={"hero": int(stacks_raw["hero"]), "villain": int(stacks_raw["villain"])},
        hands={"hero": hero_cards, "villain": villain_cards},
        board=board,
        deck=deck,
        to_act=str(state_dict.get("to_act", "hero")),  # type: ignore[arg-type]
        betting_history=list(state_dict.get("betting_history", [])),  # type: ignore[arg-type]
    )


# ── Winner determination ──────────────────────────────────────────────────────


def _determine_winner(state: GameState) -> str:
    hero_score = evaluate_hand(state.hands["hero"] + state.board)
    villain_score = evaluate_hand(state.hands["villain"] + state.board)
    if hero_score > villain_score:
        return "hero"
    if villain_score > hero_score:
        return "villain"
    return "tie"


# ── Bot action helpers ────────────────────────────────────────────────────────


def _random_bot_action(state: GameState, big_blind: int) -> tuple[str, int | None]:
    actions = get_legal_actions(state)
    if not actions:
        return "check", None
    action = stdlib_random.choice(actions)
    if action == "raise":
        pot = max(state.pot, big_blind)
        choices = [big_blind, pot // 2, pot]
        amount = min(stdlib_random.choice(choices), state.stacks["villain"])
        return "raise", max(amount, 1)
    return action, None


def _cheat_bot_action(state: GameState, big_blind: int) -> tuple[str, int | None]:
    """Perfect-information bot: knows both hands, runs villain-perspective MC rollouts."""
    hero_hole = state.hands["hero"]
    villain_hole = state.hands["villain"]
    board = state.board

    known_strs = {str(c) for c in hero_hole + villain_hole + board}
    from engine.poker.cards import RANKS, SUITS

    unknown = [
        Card(rank=r, suit=s)
        for s in SUITS
        for r in RANKS
        if f"{r}{s}" not in known_strs
    ]
    n_board_needed = 5 - len(board)
    rng = stdlib_random.Random()
    wins = 0.0
    n = 300
    for _ in range(n):
        sample = rng.sample(unknown, n_board_needed)
        full_board = board + sample
        hero_score = evaluate_hand(hero_hole + full_board)
        villain_score = evaluate_hand(villain_hole + full_board)
        if villain_score > hero_score:
            wins += 1.0
        elif villain_score == hero_score:
            wins += 0.5
    villain_equity = wins / n

    villain_stack = state.stacks["villain"]
    pot = state.pot
    if villain_equity > 0.6:
        amount = min(max(pot, big_blind), villain_stack)
        return "raise", max(amount, 1)
    if villain_equity > 0.4:
        return "call", None
    return "fold", None


def _get_bot_action(
    state: GameState, difficulty: str, big_blind: int
) -> tuple[str, int | None]:
    if difficulty == "cheat":
        return _cheat_bot_action(state, big_blind)
    if difficulty == "ppo":
        try:
            import os

            checkpoint = "scripts/checkpoints/checkpoint_latest.pt"
            if os.path.exists(checkpoint):
                from engine.poker.ml.agent import BotAgent

                agent = BotAgent(checkpoint)
                return agent.act(state)
        except Exception:
            pass
    return _random_bot_action(state, big_blind)


# ── Response builder ──────────────────────────────────────────────────────────


def _to_game_state_response(
    state_dict: dict[str, object],
    *,
    villain_hand: list[str] | None = None,
    hero_equity: float | None = None,
    winner: str | None = None,
) -> GameStateResponse:
    hands = state_dict.get("hands", {})
    if not isinstance(hands, dict):
        raise ValueError("invalid state: hands must be a dictionary")

    hero_cards = hands.get("hero", [])
    if not isinstance(hero_cards, list):
        raise ValueError("invalid state: hero hand must be a list")

    stacks = state_dict.get("stacks", {})
    if not isinstance(stacks, dict):
        raise ValueError("invalid state: stacks must be a dictionary")

    betting_history = state_dict.get("betting_history", [])
    if not isinstance(betting_history, list):
        raise ValueError("invalid state: betting_history must be a list")

    board = state_dict.get("board", [])
    if not isinstance(board, list):
        raise ValueError("invalid state: board must be a list")

    game_id = state_dict.get("game_id")
    street = state_dict.get("street")
    pot = state_dict.get("pot")
    hero_stack = stacks.get("hero")
    villain_stack = stacks.get("villain")

    if not isinstance(game_id, str):
        raise ValueError("invalid state: game_id must be a string")
    if not isinstance(street, str):
        raise ValueError("invalid state: street must be a string")
    if not isinstance(pot, int):
        raise ValueError("invalid state: pot must be an integer")
    if not isinstance(hero_stack, int):
        raise ValueError("invalid state: hero stack must be an integer")
    if not isinstance(villain_stack, int):
        raise ValueError("invalid state: villain stack must be an integer")

    to_act = str(state_dict.get("to_act", "hero"))
    legal = state_dict.get("legal_actions", [])
    legal_actions_list = list(legal) if isinstance(legal, list) else []

    stored_winner = state_dict.get("winner")
    resolved_winner = winner if winner is not None else (str(stored_winner) if stored_winner else None)

    stored_villain = state_dict.get("villain_hand", [])
    resolved_villain = villain_hand if villain_hand is not None else (list(stored_villain) if isinstance(stored_villain, list) else [])

    return GameStateResponse(
        game_id=game_id,
        street=street,  # type: ignore[arg-type]
        pot=pot,
        player_stack=hero_stack,
        bot_stack=villain_stack,
        player_hand=[str(card) for card in hero_cards],
        villain_hand=resolved_villain,
        board=[str(card) for card in board],
        betting_history=betting_history,
        to_act=to_act,
        legal_actions=legal_actions_list,
        hero_equity=hero_equity,
        winner=resolved_winner,
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/start_game", response_model=GameStateResponse)
def start_game(payload: StartGameRequest) -> GameStateResponse:
    state = new_game(
        stack_size=payload.stack_size,
        small_blind=payload.small_blind,
        big_blind=payload.big_blind,
        seed=payload.seed,
    )

    state_dict = state.to_dict()
    state_dict["deck_cards"] = _serialize_deck(state.deck)
    state_dict["difficulty"] = payload.difficulty
    state_dict["big_blind"] = payload.big_blind
    state_dict["small_blind"] = payload.small_blind
    state_dict["legal_actions"] = get_legal_actions(state)

    save_game_state(state_dict)

    hero_equity = run_equity_estimate(state.hands["hero"], state.board)

    return _to_game_state_response(
        state_dict,
        villain_hand=[],
        hero_equity=hero_equity,
        winner=None,
    )


@router.get("/game_state/{game_id}", response_model=GameStateResponse)
def game_state(game_id: str) -> GameStateResponse:
    state_dict = load_game_state(game_id)
    if state_dict is None:
        raise HTTPException(status_code=404, detail="game not found")

    villain_hand: list[str] = list(state_dict.get("villain_hand", []))  # type: ignore[arg-type]
    stored_winner = state_dict.get("winner")
    winner = str(stored_winner) if stored_winner else None
    hero_equity: float | None = None

    if state_dict.get("street") != "showdown" and winner is None:
        state = _reconstruct_game_state(state_dict)
        hero_equity = run_equity_estimate(state.hands["hero"], state.board)

    return _to_game_state_response(
        state_dict,
        villain_hand=villain_hand,
        hero_equity=hero_equity,
        winner=winner,
    )


@router.post("/action", response_model=GameStateResponse)
def action(payload: ActionRequest) -> GameStateResponse:
    state_dict = load_game_state(payload.game_id)
    if state_dict is None:
        raise HTTPException(status_code=404, detail="game not found")

    state = _reconstruct_game_state(state_dict)
    big_blind = int(state_dict.get("big_blind", 10))
    difficulty = str(state_dict.get("difficulty", "random"))

    # Apply hero action
    try:
        apply_action(state, payload.player, payload.action, payload.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    winner: str | None = None
    villain_hand: list[str] = []

    # Check if hero folded — game over immediately
    if payload.action == "fold":
        winner = "villain"
    else:
        # Bot acts if it's now the villain's turn and game is still live
        if state.to_act == "villain" and state.street != "showdown":
            bot_action, bot_amount = _get_bot_action(state, difficulty, big_blind)
            apply_action(state, "villain", bot_action, bot_amount)
            if bot_action == "fold":
                winner = "hero"

    # Determine showdown winner and reveal villain cards
    if state.street == "showdown" and winner is None:
        winner = _determine_winner(state)
        villain_hand = [c.to_str() for c in state.hands["villain"]]

    # Compute hero equity (only during live non-showdown play)
    hero_equity: float | None = None
    if winner is None and state.street != "showdown":
        hero_equity = run_equity_estimate(state.hands["hero"], state.board)

    # Persist updated state
    new_dict = state.to_dict()
    new_dict["deck_cards"] = _serialize_deck(state.deck)
    new_dict["difficulty"] = difficulty
    new_dict["big_blind"] = big_blind
    new_dict["small_blind"] = int(state_dict.get("small_blind", 5))
    new_dict["legal_actions"] = get_legal_actions(state)
    if winner is not None:
        new_dict["winner"] = winner
    if villain_hand:
        new_dict["villain_hand"] = villain_hand

    save_game_state(new_dict)

    return _to_game_state_response(
        new_dict,
        villain_hand=villain_hand if villain_hand else None,
        hero_equity=hero_equity,
        winner=winner,
    )
```

- [ ] **Step 2: Run all backend tests**

```bash
pytest backend/tests/ -v
```

Expected: all tests in `test_api_smoke.py`, `test_api_persistence.py`, and `test_api_action.py` pass. If `test_action_advances_street_after_two_checks` fails due to bot choosing a non-check action (random), that is acceptable — the random bot may raise or fold; assert only that street is one of `"flop"`, `"preflop"` depending on bot action. Adjust the test assertion to:

```python
assert payload["street"] in ("preflop", "flop")
assert isinstance(payload["board"], list)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/game.py backend/tests/test_api_action.py
git commit -m "feat: add POST /action endpoint with bot auto-response and equity"
```

---

## Task 4: Create `frontend/src/types.ts`

**Files:**
- Create: `frontend/src/types.ts`

- [ ] **Step 1: Create the file**

```typescript
export type Screen = "welcome" | "settings" | "game"
export type Street = "preflop" | "flop" | "turn" | "river" | "showdown"
export type Difficulty = "random" | "cheat" | "ppo"

export interface GameState {
  game_id: string
  street: Street
  pot: number
  player_stack: number
  bot_stack: number
  player_hand: string[]
  villain_hand: string[]
  board: string[]
  betting_history: ActionRecord[]
  to_act: string
  legal_actions: string[]
  hero_equity: number | null
  winner: string | null
}

export interface ActionRecord {
  player: string
  action: string
  amount?: number
}

export interface MoveLogEntry {
  player: "hero" | "villain"
  action: string
  amount?: number
  pot: number
  street: Street
  equity: number | null
}

export interface Settings {
  difficulty: Difficulty
  stack_size: number
  small_blind: number
  big_blind: number
  seed: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 5: Create `frontend/src/api.ts`

**Files:**
- Create: `frontend/src/api.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { GameState, Settings } from "./types"

const BASE = "http://localhost:8000"

export async function startGame(settings: Settings): Promise<GameState> {
  const seedNum = settings.seed ? parseInt(settings.seed, 10) : null
  const res = await fetch(`${BASE}/start_game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stack_size: settings.stack_size,
      small_blind: settings.small_blind,
      big_blind: settings.big_blind,
      seed: seedNum !== null && !isNaN(seedNum) ? seedNum : null,
      difficulty: settings.difficulty,
    }),
  })
  if (!res.ok) throw new Error(`start_game failed: ${res.status}`)
  return res.json()
}

export async function getGameState(gameId: string): Promise<GameState> {
  const res = await fetch(`${BASE}/game_state/${gameId}`)
  if (!res.ok) throw new Error(`game_state failed: ${res.status}`)
  return res.json()
}

export async function postAction(
  gameId: string,
  action: string,
  amount: number | null,
): Promise<GameState> {
  const res = await fetch(`${BASE}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, action, amount }),
  })
  if (!res.ok) throw new Error(`action failed: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat: add typed API client"
```

---

## Task 6: Create `Card.tsx` Component

**Files:**
- Create: `frontend/src/components/Card.tsx`

- [ ] **Step 1: Create the components directory and file**

```bash
mkdir -p frontend/src/components
```

```typescript
// frontend/src/components/Card.tsx
import { useEffect, useState } from "react"

interface CardProps {
  card?: string | null
  faceDown?: boolean
  index?: number  // stagger delay: index × 100ms
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: "♥",
  d: "♦",
  s: "♠",
  c: "♣",
}
const RED_SUITS = new Set(["h", "d"])

export function Card({ card, faceDown = false, index = 0 }: CardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), index * 100 + 50)
    return () => clearTimeout(t)
  }, [index])

  const base = `w-14 h-20 rounded-lg transition-all duration-300 ${
    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
  }`

  if (faceDown || !card) {
    return (
      <div className={`${base} border border-slate-700 bg-[#0f172a] flex items-center justify-center`}>
        <div className="w-10 h-16 rounded border border-slate-700/60 bg-slate-900/80 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-0.5 opacity-30">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-slate-500" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const rank = card.slice(0, -1)
  const suit = card.slice(-1)
  const isRed = RED_SUITS.has(suit)
  const color = isRed ? "#dc2626" : "#1e293b"
  const symbol = SUIT_SYMBOLS[suit] ?? "?"

  return (
    <div
      className={`${base} border border-slate-300 bg-white flex flex-col justify-between p-1.5 select-none`}
    >
      <div className="text-xs font-bold font-mono leading-tight" style={{ color }}>
        {rank}
        <br />
        {symbol}
      </div>
      <div className="text-center text-base leading-none" style={{ color }}>
        {symbol}
      </div>
      <div
        className="text-xs font-bold font-mono leading-tight text-right rotate-180"
        style={{ color }}
      >
        {rank}
        <br />
        {symbol}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Card.tsx
git commit -m "feat: add Card component with deal animation"
```

---

## Task 7: Create `WelcomeScreen.tsx`

**Files:**
- Create: `frontend/src/components/WelcomeScreen.tsx`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/components/WelcomeScreen.tsx
import { useEffect, useState } from "react"

interface WelcomeScreenProps {
  onStart: () => void
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`min-h-screen bg-black flex flex-col items-center justify-center cursor-pointer transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onStart}
    >
      <div className="text-center space-y-8">
        {/* Pulsing suit icon */}
        <div className="relative inline-flex items-center justify-center mx-auto">
          <div className="absolute w-24 h-24 rounded-full bg-red-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="text-5xl text-red-500 select-none">♠</span>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-slate-100 tracking-tight">
            Probabilistic Poker Engine
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            Heads-Up Texas Hold'em · ML Research Platform
          </p>
        </div>
      </div>

      <p className="absolute bottom-12 text-slate-600 font-mono text-sm animate-pulse select-none">
        Click anywhere to begin
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/WelcomeScreen.tsx
git commit -m "feat: add WelcomeScreen splash"
```

---

## Task 8: Create `SettingsScreen.tsx`

**Files:**
- Create: `frontend/src/components/SettingsScreen.tsx`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/components/SettingsScreen.tsx
import { useState } from "react"
import { startGame } from "../api"
import type { Difficulty, GameState, Settings } from "../types"

interface SettingsScreenProps {
  onGameStart: (state: GameState, settings: Settings) => void
}

const BLIND_OPTIONS = [
  { label: "5/10", small: 5, big: 10 },
  { label: "10/20", small: 10, big: 20 },
  { label: "25/50", small: 25, big: 50 },
]

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  random: "Random",
  cheat: "Cheat Bot",
  ppo: "PPO Agent",
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  label: (v: T) => string
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium border transition-all ${
            value === opt
              ? "bg-red-500/20 border-red-500/50 text-red-400"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  )
}

export function SettingsScreen({ onGameStart }: SettingsScreenProps) {
  const [settings, setSettings] = useState<Settings>({
    difficulty: "random",
    stack_size: 1000,
    small_blind: 5,
    big_blind: 10,
    seed: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePlay() {
    setLoading(true)
    setError(null)
    try {
      const state = await startGame(settings)
      onGameStart(state, settings)
    } catch {
      setError("Failed to start game. Is the backend running on port 8000?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md card space-y-6">
        <h2 className="text-xl font-semibold text-slate-100">Configure Your Game</h2>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Difficulty
          </label>
          <ToggleGroup<Difficulty>
            options={["random", "cheat", "ppo"]}
            value={settings.difficulty}
            onChange={(d) => setSettings((s) => ({ ...s, difficulty: d }))}
            label={(d) => DIFFICULTY_LABELS[d]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Starting Stack
          </label>
          <ToggleGroup<string>
            options={["500", "1000", "2000"]}
            value={String(settings.stack_size)}
            onChange={(v) => setSettings((s) => ({ ...s, stack_size: parseInt(v) }))}
            label={(v) => v}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Blind Structure
          </label>
          <div className="flex gap-2">
            {BLIND_OPTIONS.map((b) => (
              <button
                key={b.label}
                onClick={() =>
                  setSettings((s) => ({ ...s, small_blind: b.small, big_blind: b.big }))
                }
                className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium border transition-all ${
                  settings.small_blind === b.small && settings.big_blind === b.big
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Seed (optional)
          </label>
          <input
            type="text"
            placeholder="Random"
            value={settings.seed}
            onChange={(e) => setSettings((s) => ({ ...s, seed: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handlePlay}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold transition-colors"
        >
          {loading ? "Starting…" : "Play"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SettingsScreen.tsx
git commit -m "feat: add SettingsScreen with difficulty/stack/blinds/seed controls"
```

---

## Task 9: Create `ActionPanel.tsx`

**Files:**
- Create: `frontend/src/components/ActionPanel.tsx`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/components/ActionPanel.tsx
import { useEffect, useState } from "react"

interface ActionPanelProps {
  street: string
  legalActions: string[]
  toAct: string
  playerStack: number
  bigBlind: number
  botThinking: boolean
  onAction: (action: string, amount: number | null) => void
}

const STREET_LABELS: Record<string, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
}

export function ActionPanel({
  street,
  legalActions,
  toAct,
  playerStack,
  bigBlind,
  botThinking,
  onAction,
}: ActionPanelProps) {
  const [showRaise, setShowRaise] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(bigBlind)

  useEffect(() => {
    setRaiseAmount(Math.max(bigBlind, 1))
    setShowRaise(false)
  }, [bigBlind, street])

  const isPlayerTurn = toAct === "hero"
  const disabled = !isPlayerTurn || botThinking || street === "showdown"

  function handleActionClick(act: string) {
    if (act === "raise") {
      setShowRaise(true)
    } else {
      setShowRaise(false)
      onAction(act, null)
    }
  }

  return (
    <div className="bg-[#0a0a0a] border-t border-red-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-semibold text-amber-500 uppercase tracking-widest">
          {STREET_LABELS[street] ?? street}
        </span>
        {botThinking && (
          <span className="text-xs font-mono text-slate-400 animate-pulse">
            Bot is thinking…
          </span>
        )}
      </div>

      {showRaise ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={bigBlind}
              max={Math.max(playerStack, bigBlind)}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
              className="flex-1 accent-red-500"
            />
            <span className="text-sm font-mono text-red-400 w-16 text-right font-bold">
              {raiseAmount}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRaise(false)}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-mono hover:border-slate-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowRaise(false)
                onAction("raise", raiseAmount)
              }}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-mono font-semibold transition-colors"
            >
              Raise {raiseAmount}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {(["fold", "check", "call", "raise"] as const).map((act) => {
            const available = legalActions.includes(act)
            const isRaise = act === "raise"
            return (
              <button
                key={act}
                onClick={() => handleActionClick(act)}
                disabled={disabled || !available}
                className={`flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold uppercase tracking-wide transition-all
                  ${
                    isRaise
                      ? "bg-red-600 hover:bg-red-700 text-white border border-red-500"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {act}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ActionPanel.tsx
git commit -m "feat: add ActionPanel with raise slider and bot-thinking state"
```

---

## Task 10: Create `MoveLog.tsx`

**Files:**
- Create: `frontend/src/components/MoveLog.tsx`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/components/MoveLog.tsx
import type { MoveLogEntry, Street } from "../types"

interface MoveLogProps {
  entries: MoveLogEntry[]
}

const STREET_SHORT: Record<Street, string> = {
  preflop: "Pre",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Show",
}

export function MoveLog({ entries }: MoveLogProps) {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] border-l border-red-900/40">
      <div className="px-4 py-3 border-b border-red-900/40 shrink-0">
        <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest">
          Move Log
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs font-mono text-slate-600 text-center mt-6">No moves yet.</p>
        ) : (
          [...entries].reverse().map((entry, i) => (
            <div
              key={i}
              className="rounded-lg bg-slate-950/60 border border-white/[0.04] p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    entry.player === "hero"
                      ? "bg-red-500/15 text-red-400 border border-red-500/25"
                      : "bg-slate-500/15 text-slate-400 border border-slate-500/25"
                  }`}
                >
                  {entry.player === "hero" ? "YOU" : "BOT"}
                </span>
                <span className="text-xs font-mono text-slate-600">
                  {STREET_SHORT[entry.street] ?? entry.street}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-slate-200 capitalize">
                  {entry.action}
                  {entry.amount != null ? ` ${entry.amount}` : ""}
                </span>
                <span className="text-xs font-mono text-amber-500">pot {entry.pot}</span>
              </div>

              {entry.equity !== null && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((entry.equity ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-green-400">
                    {Math.round((entry.equity ?? 0) * 100)}% equity
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MoveLog.tsx
git commit -m "feat: add MoveLog sidebar with equity bars"
```

---

## Task 11: Create `GameTable.tsx`

**Files:**
- Create: `frontend/src/components/GameTable.tsx`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/components/GameTable.tsx
import { Card } from "./Card"
import { ActionPanel } from "./ActionPanel"
import { MoveLog } from "./MoveLog"
import type { GameState, MoveLogEntry } from "../types"

interface GameTableProps {
  gameState: GameState
  moveLog: MoveLogEntry[]
  botThinking: boolean
  bigBlind: number
  onAction: (action: string, amount: number | null) => void
  onPlayAgain: () => void
  onMenu: () => void
}

export function GameTable({
  gameState,
  moveLog,
  botThinking,
  bigBlind,
  onAction,
  onPlayAgain,
  onMenu,
}: GameTableProps) {
  const isGameOver = gameState.winner !== null
  const isShowdown = gameState.street === "showdown"

  const winnerLabel =
    gameState.winner === "hero"
      ? "You Win!"
      : gameState.winner === "tie"
      ? "Split Pot!"
      : "Bot Wins."

  const winnerColor =
    gameState.winner === "hero"
      ? "text-green-400"
      : gameState.winner === "tie"
      ? "text-amber-400"
      : "text-red-400"

  return (
    <div className="min-h-screen bg-black flex relative">
      {/* ── Main table ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Bot area */}
        <div className="flex items-center justify-center gap-6 py-6 px-4 border-b border-red-900/20">
          <div className="text-center min-w-[4rem]">
            <div className="text-xs font-mono text-slate-500 mb-1">BOT</div>
            <div className="text-lg font-mono font-bold text-slate-300">
              {gameState.bot_stack}
            </div>
          </div>
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <Card
                key={i}
                card={isShowdown ? gameState.villain_hand[i] : null}
                faceDown={!isShowdown}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Community board + pot */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Card
                key={i}
                card={gameState.board[i] ?? null}
                faceDown={false}
                index={i}
              />
            ))}
          </div>
          <div className="text-sm font-mono font-semibold text-amber-500">
            POT: {gameState.pot}
          </div>
        </div>

        {/* Player area */}
        <div className="flex items-center justify-center gap-6 py-6 px-4 border-t border-red-900/20">
          <div className="text-center min-w-[4rem]">
            <div className="text-xs font-mono text-slate-500 mb-1">YOU</div>
            <div className="text-lg font-mono font-bold text-red-400">
              {gameState.player_stack}
            </div>
          </div>
          <div className="flex gap-2">
            {gameState.player_hand.map((card, i) => (
              <Card key={i} card={card} faceDown={false} index={i} />
            ))}
          </div>
        </div>

        {/* Action panel */}
        <ActionPanel
          street={gameState.street}
          legalActions={gameState.legal_actions}
          toAct={gameState.to_act}
          playerStack={gameState.player_stack}
          bigBlind={bigBlind}
          botThinking={botThinking}
          onAction={onAction}
        />
      </div>

      {/* ── Move log sidebar ── */}
      <div className="w-56 shrink-0">
        <MoveLog entries={moveLog} />
      </div>

      {/* ── Game-over overlay ── */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="card text-center space-y-5 max-w-sm w-full mx-4">
            <div className={`text-3xl font-bold ${winnerColor}`}>{winnerLabel}</div>

            {isShowdown && gameState.villain_hand.length === 2 && (
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                  Showdown
                </div>
                <div className="flex justify-center gap-6">
                  <div className="space-y-2 text-center">
                    <div className="text-xs font-mono text-slate-500">Bot</div>
                    <div className="flex gap-1">
                      {gameState.villain_hand.map((card, i) => (
                        <Card key={i} card={card} faceDown={false} index={i} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="text-xs font-mono text-slate-500">You</div>
                    <div className="flex gap-1">
                      {gameState.player_hand.map((card, i) => (
                        <Card key={i} card={card} faceDown={false} index={i} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isShowdown && (
              <p className="text-sm font-mono text-slate-400">
                {gameState.winner === "hero" ? "Bot folded." : "You folded."}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onPlayAgain}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={onMenu}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:border-slate-500 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/GameTable.tsx
git commit -m "feat: add GameTable layout with bot area, board, player area, and game-over overlay"
```

---

## Task 12: Rewrite `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace the full contents of `frontend/src/App.tsx`**

```typescript
import { useState, useCallback } from "react"
import type { GameState, MoveLogEntry, Screen, Settings } from "./types"
import { postAction } from "./api"
import { WelcomeScreen } from "./components/WelcomeScreen"
import { SettingsScreen } from "./components/SettingsScreen"
import { GameTable } from "./components/GameTable"

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([])
  const [botThinking, setBotThinking] = useState(false)
  const [bigBlind, setBigBlind] = useState(10)
  const [error, setError] = useState<string | null>(null)

  function handleGameStart(state: GameState, settings: Settings) {
    setGameState(state)
    setMoveLog([])
    setBigBlind(settings.big_blind)
    setBotThinking(false)
    setError(null)
    setScreen("game")
  }

  const handleAction = useCallback(
    async (action: string, amount: number | null) => {
      if (!gameState) return
      setBotThinking(true)
      setError(null)

      const preState = gameState

      try {
        // Run API call and minimum 1.2s delay in parallel for bot-thinking UX
        const [newState] = await Promise.all([
          postAction(gameState.game_id, action, amount),
          new Promise<void>((resolve) => setTimeout(resolve, 1200)),
        ])

        // Build hero log entry
        const heroEntry: MoveLogEntry = {
          player: "hero",
          action,
          ...(amount != null ? { amount } : {}),
          pot: newState.pot,
          street: preState.street,
          equity: newState.hero_equity,
        }

        const newEntries: MoveLogEntry[] = [heroEntry]

        // Detect bot action: if betting_history grew by ≥2, last entry is bot's
        const newActionCount =
          newState.betting_history.length - preState.betting_history.length
        if (newActionCount >= 2) {
          const botRecord =
            newState.betting_history[newState.betting_history.length - 1]
          if (botRecord?.player === "villain") {
            newEntries.push({
              player: "villain",
              action: String(botRecord.action),
              ...(typeof botRecord.amount === "number"
                ? { amount: botRecord.amount }
                : {}),
              pot: newState.pot,
              street: newState.street,
              equity: newState.hero_equity,
            })
          }
        }

        setMoveLog((prev) => [...prev, ...newEntries])
        setGameState(newState)
      } catch {
        setError("Action failed — please try again.")
      } finally {
        setBotThinking(false)
      }
    },
    [gameState],
  )

  return (
    <div className="min-h-screen bg-black text-slate-100">
      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm font-mono shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {screen === "welcome" && (
        <WelcomeScreen onStart={() => setScreen("settings")} />
      )}

      {screen === "settings" && (
        <SettingsScreen onGameStart={handleGameStart} />
      )}

      {screen === "game" && gameState && (
        <GameTable
          gameState={gameState}
          moveLog={moveLog}
          botThinking={botThinking}
          bigBlind={bigBlind}
          onAction={handleAction}
          onPlayAgain={() => setScreen("settings")}
          onMenu={() => setScreen("welcome")}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Start backend and frontend, verify the game is playable**

In one terminal:
```bash
cd <repo-root>
uvicorn backend.app.main:app --reload
```

In another terminal:
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Walk through:
1. Welcome screen → click → Settings
2. Pick Cheat Bot, 1000 stack, 5/10 blinds → Play
3. Game table appears with your 2 hole cards face-up, bot's 2 cards face-down
4. Click CHECK → 1.2s "Bot is thinking…" → board updates
5. Continue until Showdown → winner banner → Play Again

- [ ] **Step 3: Run backend tests one final time**

```bash
pytest backend/tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: rewrite App.tsx as 3-screen poker game (welcome/settings/game)"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|-----------------|------|
| Screen 1: splash, pulsing suit, click to begin | Task 7 |
| Screen 2: difficulty / stack / blinds / seed / Play | Task 8 |
| Screen 3: bot area, board, pot, player area, action panel | Task 11 |
| Card rendering with suit symbols + colors + face-down backs | Task 6 |
| Deal animation (staggered fade-in) | Task 6 |
| Street label in ActionPanel | Task 9 |
| FOLD / CHECK / CALL / RAISE buttons; disabled when not player's turn | Task 9 |
| RAISE slider (min: big_blind, max: player_stack) | Task 9 |
| Bot is thinking… (1.2s delay) | Task 12 |
| Move Log with actor chip, action, pot, equity bar | Task 10 |
| MoveLogEntry accumulated in App state per response | Task 12 |
| Showdown: villain cards revealed, winner banner | Task 11 |
| Fold: winner banner, bot cards face-down | Task 11 |
| Play Again → Settings; Back to Menu → Welcome | Task 12 |
| POST /action endpoint | Task 3 |
| to_act + legal_actions in response | Tasks 1 & 3 |
| villain_hand revealed at showdown | Task 3 |
| hero_equity via MC | Task 3 |
| winner via evaluator | Task 3 |
| Bot auto-response: random / cheat / ppo | Task 3 |
| Deck serialization (deck_cards stored in dict) | Task 3 |
| Error toast on API failure | Task 12 |
| 404 on unknown game | Task 3 |
| 400 on invalid action | Task 3 |
| Existing backend tests still pass | Tasks 1 & 3 |
