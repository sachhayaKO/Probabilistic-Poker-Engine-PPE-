# Backend Upgrade Notes

## Project goals (current interpretation)

The repository aims to provide a heads-up Texas Hold'em service where:
- FastAPI exposes stable game lifecycle endpoints.
- The poker engine owns game rules/state transitions.
- The backend stores and retrieves state within a process lifetime.
- Deterministic behavior is available for tests/simulations via seed support.

## What was added

### 1) In-memory game state storage
- `backend/app/storage/db.py` uses a module-level dict `game_store: dict[str, dict[str, object]]`.
- `save_game_state(state_dict)`: upserts by `game_id`.
- `load_game_state(game_id)`: returns the stored dict or `None`.
- No database, no SQL, no external dependencies.

### 2) Test isolation
- `reset_db()` clears `game_store` between tests.
- `init_db()` is a no-op compatibility hook called at app startup.

### 3) Route flow
- `POST /start_game`, `POST /action`, and `GET /game_state/{game_id}` all read/write through `save_game_state` / `load_game_state`.
- Routes call engine APIs (`new_game`, `apply_action`, `legal_actions`) from `engine.poker`.

### 4) Startup + logging
- App startup calls `init_db()` (no-op).
- Centralized logging enabled through config.

### 5) Strong schema typing
- `Literal` enum validation for players/actions/streets via Pydantic.

### 6) Testing
- API and persistence tests run against the in-memory store via `reset_db()` in fixtures.

## Remaining backend work

- Persistent storage with SQLite or PostgreSQL (state is currently lost on process restart).
- Add authentication and authorization for private game state.
- Add structured error model and request IDs.
- Add observability (metrics/tracing).
- Add Alembic migrations if/when persistent storage is introduced.
