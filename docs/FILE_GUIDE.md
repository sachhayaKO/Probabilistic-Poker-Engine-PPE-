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
- Defines `/game` routes:
  - `POST /game/new`
  - `POST /game/action`
  - `GET /game/state/{game_id}`
- Uses persistent storage helpers (`save_game`, `load_game`, `save_action`) rather than process-local state.
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
- Database adapter layer with a shared API for SQLite and PostgreSQL.
- CRUD-style helpers for game snapshots and action events.
- Uses `PPE_DATABASE_URL` (`sqlite:///...` default; `postgresql+psycopg://...` supported).
- `reset_db` helper for test isolation.

### `backend/app/storage/models.py`
- Serialization/deserialization between `GameState` and storage JSON payloads.
- `ActionRecord` storage model for action history rows.

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
- Evaluator interface placeholder (`NotImplementedError`).

### `engine/poker/betting.py`
- Betting logic placeholder.

### `engine/poker/__init__.py`
- Re-export module API (`Card`, `Deck`, `GameState`, `new_game`, `apply_action`, `legal_actions`).

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

1. Client calls backend endpoint.
2. FastAPI validates payload with Pydantic schema.
3. Route loads current game state from configured SQLite/PostgreSQL backend.
4. Route calls engine function to mutate/advance state.
5. Route persists updated game snapshot and action record.
6. Route returns normalized `GameResponse` payload.

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

### Persistence (SQLite + PostgreSQL via Psycopg)
- `sqlite3` path for local/dev and tests.
- `psycopg` path for PostgreSQL deployments.
- Shared persistence functions hide backend-specific SQL from routes.

### Dataclasses + typing
- `@dataclass(frozen=True)` for immutable `Card`.
- `@dataclass` for mutable state records.
- `Literal`, `dict[str, object]`, `int | None` for explicit typing.

### Testing
- `pytest` for test execution.
- `fastapi.testclient.TestClient` for in-process HTTP-style route tests.
