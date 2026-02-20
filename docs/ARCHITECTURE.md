# Architecture

## High-level component diagram

```text
+----------------------+            +----------------------+
|    Client / UI       | <--------> |   FastAPI Backend    |
| (CLI/Web/Future UI)  |  HTTP/JSON |  (/backend/app)      |
+----------------------+            +----------+-----------+
                                               |
                                               | Engine calls
                                               v
                                   +-----------+-----------+
                                   |   Poker Engine         |
                                   |  (/engine/poker)       |
                                   +-----------+------------+
                                               |
                               +---------------+----------------+
                               | Probability / Cheat Bot Logic  |
                               | (planned in engine + scripts)  |
                               +---------------+----------------+
                                               |
                                               v
                                   +-----------+------------+
                                   |   Storage (optional)    |
                                   | (/backend/app/storage)  |
                                   +-------------------------+
```

## Responsibilities

- **Backend (`backend/app`)**
  - Define API routes for game lifecycle.
  - Validate payloads with schemas.
  - Coordinate engine calls and return serializable state.
  - Integrate logging and configuration.
- **Engine (`engine/poker`)**
  - Own game rules, turn order, legal actions, and showdown evaluation.
  - Provide deterministic interfaces for simulations and tests.
  - Serve both online API and offline experiment tooling.
- **Scripts (`scripts/`)**
  - Run repeatable simulations (self-play, Monte Carlo rollouts).
  - Generate datasets/features for future ML opponent training.
- **Docs (`docs/`)**
  - Keep architecture, API contracts, and decisions synchronized.
- **Tests (`backend/tests`, `engine/tests`)**
  - Protect route stability and core game/evaluator correctness.

## Integration flow (planned)

1. Client starts a game through backend endpoint.
2. Backend initializes engine state.
3. Client submits actions; backend validates and applies via engine.
4. Backend optionally requests cheat-bot probabilities for diagnostics.
5. Backend returns updated state and legal next actions.
