# File-by-File Guide and Interaction Map

This guide explains what each file currently does, how files connect, and what Python/FastAPI/Pydantic APIs are in use.

## Root files

- `README.md`: project overview, repo map, and implementation roadmap.
- `LICENSE`: MIT license.
- `.gitignore`: excludes bytecode, virtualenvs, caches, IDE files.
- `pyproject.toml`: package metadata, Python version, dependencies, and pytest config.
- `requirements.txt`: pip install list for runtime/test dependencies.
- `init_repo.sh`: one-shot scaffold script used to generate initial repository structure and file placeholders.

## Backend (`backend/app`)

### `backend/app/main.py`
- Creates the `FastAPI` app.
- Initializes logging and DB schema on startup.
- Registers `GET /health` and includes game router.

### `backend/app/routes/game.py`
- Defines game routes:
  - `POST /start_game`
  - `POST /action`
  - `GET /game_state/{game_id}`
- Uses in-memory storage helpers (`save_game_state`, `load_game_state`) from `backend.app.storage`.
- Calls engine APIs (`new_game`, `apply_action`, `legal_actions`) from `engine.poker`.
- Maps engine `ValueError` to HTTP 400.

### `backend/app/schemas/game.py`
- Pydantic models for request/response bodies.
- Adds `Literal` enum-style typing for player/action/street values.
- Uses `Field(gt=0)` validation for positive numeric fields.

### `backend/app/core/config.py`
- Environment-driven settings:
  - DB path
  - log level
  - persistence toggle

### `backend/app/core/logging.py`
- Centralized logging setup and logger retrieval.

### `backend/app/storage/db.py`
- Pure in-memory storage: `game_store: dict[str, dict[str, object]]` module-level dict.
- `save_game_state(state_dict)`: upsert by `game_id`.
- `load_game_state(game_id)`: returns dict or `None`.
- `reset_db()`: clears the dict for test isolation.
- `init_db()`: no-op compatibility hook called at app startup.

### `backend/app/storage/models.py`
- Serialization/deserialization between `GameState` and storage JSON payloads.

## Engine (`engine/poker`)

### `engine/poker/cards.py`
- Defines immutable `Card` dataclass with validation.
- Defines seeded `Deck` for deterministic shuffle/deal.

### `engine/poker/state.py`
- Defines `GameState` dataclass and serialization helpers:
  - `to_public_dict()`
  - `to_private_dict(player)`

### `engine/poker/game.py`
- Defines backend-facing orchestration APIs:
  - `new_game(...)`
  - `apply_action(...)`
  - `legal_actions(...)`

### `engine/poker/evaluator.py`
- Custom pure-Python hand evaluator using `itertools.combinations`.
- Returns a numeric score for a 5–7 card list.

### `engine/poker/betting.py`
- Betting round logic: blind posting, action sequencing, street transitions.

### `engine/poker/__init__.py`
- Re-export module API (`Card`, `Deck`, `GameState`, `new_game`, `apply_action`, `legal_actions`).

### `engine/poker/ml/__init__.py`
- Package marker for the ML sub-module.

### `engine/poker/ml/agent.py`
- `BotAgent`: loads a PPO checkpoint and exposes `act(state) -> (action, amount)`.

### `engine/poker/ml/equity.py`
- `run_equity_estimate(hole_cards, board)`: Monte Carlo equity estimate for the hero's hand.

### `engine/poker/ml/model.py`
- `PPEActorCritic`: shared-trunk actor-critic network (policy head + value head) implemented in PyTorch.

### `engine/poker/ml/state_encoder.py`
- `GameStateEncoder`: converts a `GameState` to a 30-dimensional float vector for model input.

## Scripts (`scripts/`)

### `scripts/train_self_play.py`
- Self-play PPO training loop.
- Saves numbered checkpoints and `scripts/checkpoints/checkpoint_latest.pt`.

### `scripts/run_monte_carlo.py`
- Standalone Monte Carlo equity runner for hand analysis.

### `scripts/simulate_self_play.py`
- Simulates games between two bot policies for benchmarking.

## Frontend (`frontend/src/`)

### `frontend/src/main.tsx`
- React app entry point; mounts `<App />` into the DOM.

### `frontend/src/App.tsx`
- Top-level component; manages screen routing (welcome → game).

### `frontend/src/api.ts`
- Typed fetch wrappers for all backend endpoints (`startGame`, `getGameState`, `postAction`).

### `frontend/src/types.ts`
- TypeScript types mirroring the Pydantic response schemas.

### `frontend/src/index.css`
- Tailwind CSS base styles.

### `frontend/src/components/WelcomeScreen.tsx`
- Difficulty selector and game start UI.

### `frontend/src/components/SettingsScreen.tsx`
- Game configuration form (stack size, blinds, seed).

### `frontend/src/components/GameTable.tsx`
- Main game board: board cards, pot, stacks, and bot hand reveal at showdown.

### `frontend/src/components/ActionPanel.tsx`
- Hero action buttons; shows only legal actions for the current state.

### `frontend/src/components/Card.tsx`
- Renders a single playing card with rank/suit styling.

### `frontend/src/components/MoveLog.tsx`
- Scrollable history of betting actions.

## Tests

### `backend/tests/test_api_smoke.py`
- End-to-end API smoke flow.
- Adds invalid payload test for schema-level enum enforcement (`422`).

### `backend/tests/test_api_persistence.py`
- Verifies game state is persisted/retrieved through storage-backed routes.
- Verifies unknown game path returns `404`.

### `engine/tests/test_evaluator_cases.py`
- Covers card parsing, deterministic deck behavior, and initial public-state shape.

## Docs

- `docs/ARCHITECTURE.md`: component boundaries and interaction intent.
- `docs/API_CONTRACT.md`: Day 1 endpoint contracts.
- `docs/STATE_REPRESENTATION.md`: planned ML feature encoding.
- `docs/DECISIONS.md`: scope simplifications and open choices.
- `docs/BACKEND_IMPLEMENTATION.md`: summary of backend upgrades and remaining work.

## Interaction map (current runtime path)

1. Client calls backend endpoint (`/start_game`, `/action`, or `/game_state/{game_id}`).
2. FastAPI validates payload with Pydantic schema.
3. Route calls `load_game_state(game_id)` to read from the in-memory `game_store` dict.
4. Route calls engine function (`new_game`, `apply_action`, `legal_actions`) to mutate/advance state.
5. Route calls `save_game_state(state_dict)` to persist the updated snapshot in `game_store`.
6. Route returns a `GameStateResponse` payload.

## Python + framework APIs used (learning notes)

### FastAPI
- `FastAPI(...)`: app container.
- `APIRouter(...)`: route grouping.
- `@router.post/@router.get`: endpoint declaration.
- `response_model=...`: typed output contracts.
- `HTTPException`: explicit API error signaling.

### Pydantic
- `BaseModel`: typed request/response contracts.
- `Field(gt=0)`: runtime value constraints.
- `Literal[...]`: enum-like value restrictions.

### Persistence (in-memory)
- `game_store` is a plain `dict[str, dict[str, object]]` in `backend/app/storage/db.py`.
- `save_game_state` / `load_game_state` are the only storage helpers used by routes.
- State is lost on process restart; persistent storage (SQLite/PostgreSQL) is a future goal.

### Dataclasses + typing
- `@dataclass(frozen=True)` for immutable `Card`.
- `@dataclass` for mutable state records.
- `Literal`, `dict[str, object]`, `int | None` for explicit typing.

### Testing
- `pytest` for test execution.
- `fastapi.testclient.TestClient` for in-process HTTP-style route tests.
