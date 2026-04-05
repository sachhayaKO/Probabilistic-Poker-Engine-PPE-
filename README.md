# Probabilistic Poker Engine (PPE)

A fully functional heads-up Texas Hold'em ML research platform. Play against bots ranging from random to a PPO-trained neural agent, while the engine computes real-time Monte Carlo equity estimates.

## What it is

PPE combines:
- A pure-Python poker engine with Monte Carlo equity estimation
- A FastAPI backend managing game state and bot logic
- A React/TypeScript/Tailwind frontend for human vs. bot play
- Three bot difficulties: random, cheat bot (perfect-information MC), and a PPO-trained agent
- A self-play PPO training pipeline for iterating on the ML opponent

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, Pydantic |
| ML | PyTorch |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |

## Running locally

**Backend**

```bash
# From repo root
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

## Project structure

```
backend/      FastAPI app, routes (/start_game, /action, /game_state), schemas, config
engine/       Pure-Python poker engine: cards, evaluator, betting rounds, game loop, MC equity
frontend/     React/TypeScript/Tailwind game UI
scripts/      Self-play PPO training (train_self_play.py) and utility scripts
scripts/checkpoints/  PPO checkpoint storage (checkpoint_latest.pt loaded at runtime)
docs/         Architecture, API contract, state representation, and decision log
```

## Running tests

```bash
# Short form — pyproject.toml sets testpaths automatically
pytest

# Equivalent explicit form
pytest backend/tests/ engine/tests/ -v
```

## Bot modes

| Mode | Description |
|------|-------------|
| `random` | Uniform action sampling — fold/call/raise with equal probability |
| `cheat` | Perfect-information Monte Carlo: sees both hole cards, runs 300 rollouts to pick the highest-EV action |
| `ppo` | PPO-trained neural agent — loads checkpoint from `scripts/checkpoints/checkpoint_latest.pt`; falls back to random if no checkpoint exists |

## ML pipeline

- **State encoding**: `GameStateEncoder` produces 30-dimensional state vectors from raw game state
- **Model**: `PPEActorCritic` — shared-trunk actor-critic network (policy head + value head)
- **Training**: self-play PPO via `python scripts/train_self_play.py`

Checkpoints are saved to `scripts/checkpoints/`. The backend loads `checkpoint_latest.pt` at startup when `difficulty=ppo` is selected.
