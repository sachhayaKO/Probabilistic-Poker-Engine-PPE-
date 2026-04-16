# Probabilistic Poker Engine (PPE)

A fully functional heads-up Texas Hold'em ML research platform. Play multi-hand sessions against bots ranging from random to a PPO-trained neural agent, while the engine computes real-time Monte Carlo equity estimates.

## What it is

PPE combines:
- A pure-Python poker engine with Monte Carlo equity estimation
- A FastAPI backend managing game state and bot logic across multiple hands
- A React/TypeScript/Tailwind frontend for human vs. bot play
- Three bot difficulties: random, cheat bot (perfect-information MC), and a PPO-trained agent
- Multi-hand sessions: chip stacks persist across hands and play continues until one player busts
- A self-play PPO training pipeline for iterating on the ML opponent

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, Pydantic |
| ML | PyTorch |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |

## Prerequisites

- Python 3.11+
- Node 20+

## Running locally

**Backend**

```bash
# From repo root
pip install -e ".[dev]"
uvicorn backend.app.main:app --reload
```

API is available at `http://localhost:8000`.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

UI is available at `http://localhost:5173`.

## Running tests

```bash
# pyproject.toml sets testpaths = ["backend/tests", "engine/tests"] automatically
pytest
```

## Gameplay

- Sessions run until one player reaches 0 chips — not just one hand
- After each hand, the pot is awarded to the winner and a new hand starts automatically with the updated stacks
- A brief transition message appears between hands; the full Game Over screen with final chip counts only shows when a player busts
- Raise sizing uses standard poker presets (¼ Pot, ½ Pot, ¾ Pot, 1× Pot, 2× Pot, All-In) plus a manual slider for custom amounts; all values are clamped to `[big_blind, player_stack]`

## Bot modes

| Mode | Description |
|------|-------------|
| `random` | Uniform action sampling — fold/call/raise with equal probability |
| `cheat` | Perfect-information Monte Carlo: sees both hole cards, runs 300 rollouts to pick the highest-EV action |
| `ppo` | PPO-trained neural agent — loads `scripts/checkpoints/checkpoint_latest.pt`; **falls back to random if no checkpoint exists**. Run `python scripts/train_self_play.py` first to generate one. |

## ML pipeline

- **State encoding**: `GameStateEncoder` produces 30-dimensional state vectors from raw game state
- **Model**: `PPEActorCritic` — shared-trunk actor-critic network (policy head + value head)
- **Training**: `python scripts/train_self_play.py` — runs self-play PPO and saves checkpoints to `scripts/checkpoints/`

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/start_game` | POST | Start a new session; returns initial hand state with `hand_number: 1` |
| `/action` | POST | Submit a player action; auto-starts next hand on winner if stacks allow |
| `/game_state/{game_id}` | GET | Fetch current state (used by frontend after the between-hands pause) |

`GameStateResponse` includes `session_over: bool` (true only when a player busts) and `hand_number: int` (increments each hand).

## Project structure

```
backend/      FastAPI app, routes (/start_game, /action, /game_state), schemas, config
engine/       Pure-Python poker engine: cards, evaluator, betting rounds, game loop, MC equity
frontend/     React/TypeScript/Tailwind game UI
scripts/      Self-play PPO training (train_self_play.py) and utility scripts
scripts/checkpoints/  PPO checkpoint storage (checkpoint_latest.pt loaded at runtime)
docs/         Architecture, API contract, state representation, and decision log
```
