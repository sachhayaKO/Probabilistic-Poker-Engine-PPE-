# Backend Upgrade Notes

## Project goals (current interpretation)

The repository aims to provide a heads-up Texas Hold'em service where:
- FastAPI exposes stable game lifecycle endpoints.
- The poker engine owns game rules/state transitions.
- The backend persists and retrieves state reliably.
- Deterministic behavior is available for tests/simulations via seed support.
- Storage architecture is production-aligned and can target PostgreSQL.

## What was added

### 1) Industry-standard persistence foundation (PostgreSQL-ready)
- Added a dual backend storage layer:
- SQLite for local/dev and tests by default.
- PostgreSQL support via Psycopg for industry-standard deployments.
- Kept one consistent repository API (`save_game`, `load_game`, `save_action`).

### 2) PostgreSQL-ready configuration
- Added `PPE_DATABASE_URL` setting in config.
- Added Psycopg dependency for PostgreSQL support.
- Backend can now point to PostgreSQL by setting:
  - `PPE_DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname`

### 3) Route flow remains stable
- API routes still use the same endpoint contracts.
- Routes now persist/retrieve state through storage helpers that can target SQLite or PostgreSQL.

### 4) Startup + logging
- App startup initializes DB schema.
- Centralized logging remains enabled through config.

### 5) Strong schema typing
- `Literal` enum validation retained for players/actions/streets.

### 6) Testing
- Existing API/persistence tests run unchanged using SQLite backend URL.

## Remaining backend work

- Add Alembic migrations for schema evolution.
- Add authentication and authorization for private game state.
- Add structured error model and request IDs.
- Add observability (metrics/tracing).
- Add Postgres container service in Docker Compose for local infra.
