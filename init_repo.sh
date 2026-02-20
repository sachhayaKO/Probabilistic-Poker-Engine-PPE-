#!/usr/bin/env bash
set -euo pipefail

# Create directory structure
mkdir -p \
  docker \
  backend/app/routes \
  backend/app/schemas \
  backend/app/storage \
  backend/app/core \
  backend/tests \
  engine/poker \
  engine/tests \
  scripts \
  docs

# Root files
cat > README.md <<'EOF'
# Probabilistic Poker Engine (Heads-Up Texas Hold'em)

This repository is a scaffold for a heads-up Texas Hold'em project that combines a pure-Python poker engine, a FastAPI backend, a probability-aware "cheat bot" for baseline strategy and diagnostics, and a future ML-driven opponent. At this stage, the repository contains structure and planning documentation only, so teams can align on interfaces, responsibilities, and milestones before implementation starts.

## Quick start

1. Review repository layout and planned responsibilities in this README and `docs/`.
2. Set up local tooling and dependencies using placeholders in `pyproject.toml` and `requirements.txt`.
3. Begin implementation by replacing `# TODO: implement` placeholders.
4. Runtime commands and environment setup are **to be implemented**.

## Repository map

- `/README.md` — project overview, structure, and planning workflow.
- `/LICENSE` — MIT license text for repository usage.
- `/.gitignore` — common Python, environment, and tooling ignores.
- `/pyproject.toml` — Python project metadata and tool placeholders.
- `/requirements.txt` — initial dependency list placeholders.
- `/docker/Dockerfile` — container build placeholder for backend/engine runtime.
- `/docker/docker-compose.yml` — multi-service orchestration placeholder.
- `/backend/app/main.py` — FastAPI app entrypoint placeholder.
- `/backend/app/routes/__init__.py` — routes package marker.
- `/backend/app/routes/game.py` — game API route placeholders.
- `/backend/app/schemas/__init__.py` — schemas package marker.
- `/backend/app/schemas/game.py` — request/response schema placeholders.
- `/backend/app/storage/__init__.py` — storage package marker.
- `/backend/app/storage/db.py` — database/session integration placeholder.
- `/backend/app/storage/models.py` — persistence model placeholders.
- `/backend/app/core/__init__.py` — core package marker.
- `/backend/app/core/config.py` — configuration management placeholder.
- `/backend/app/core/logging.py` — logging setup placeholder.
- `/backend/tests/test_api_smoke.py` — backend API smoke test placeholder.
- `/engine/poker/__init__.py` — poker engine package marker.
- `/engine/poker/cards.py` — card/deck representation placeholder.
- `/engine/poker/evaluator.py` — hand evaluator placeholder.
- `/engine/poker/state.py` — game state container placeholder.
- `/engine/poker/betting.py` — betting round logic placeholder.
- `/engine/poker/game.py` — high-level game loop/orchestration placeholder.
- `/engine/tests/test_evaluator_cases.py` — evaluator test case placeholder.
- `/scripts/simulate_self_play.py` — script placeholder for self-play simulations.
- `/scripts/run_monte_carlo.py` — script placeholder for Monte Carlo experiments.
- `/docs/ARCHITECTURE.md` — system components and responsibility boundaries.
- `/docs/API_CONTRACT.md` — planned backend endpoint contracts.
- `/docs/STATE_REPRESENTATION.md` — planned ML-compatible state representation.
- `/docs/DECISIONS.md` — decision log for simplifications and trade-offs.

## Development workflow suggestion

- Use short-lived feature branches from `main` (e.g., `feature/engine-state`, `feature/api-game-routes`).
- Keep pull requests focused: one subsystem or interface slice at a time.
- Introduce linting/testing commands as placeholders first, then enforce in CI once stable.
- Suggested quality gates (to be implemented): formatting, static typing, unit tests, API smoke tests.

## Week 1 milestone checklist

- [ ] Finalize data contracts between `engine/` and `backend/`.
- [ ] Implement card/deck primitives and deterministic shuffling policy.
- [ ] Implement minimal hand evaluator for showdown ranking.
- [ ] Define game state transitions for heads-up preflop/flop/turn/river.
- [ ] Draft and validate `/game/new`, `/game/action`, and `/game/state` API responses.
- [ ] Set up first smoke tests for backend and evaluator edge cases.
- [ ] Document baseline cheat-bot probability assumptions for iteration 2.
EOF

cat > LICENSE <<'EOF'
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

cat > .gitignore <<'EOF'
# Python bytecode
__pycache__/
*.py[cod]
*.pyo

# Virtual environments
.venv/
venv/
env/

# Tooling caches
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/

# IDE files
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db
EOF

cat > pyproject.toml <<'EOF'
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "probabilistic-poker-engine"
version = "0.1.0"
description = "Heads-up Texas Hold'em engine scaffold with FastAPI backend and future ML opponent"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "fastapi",
  "uvicorn",
  "pydantic",
  "numpy",
  "scikit-learn",
  "pytest",
]

[tool.pytest.ini_options]
# TODO: implement
EOF

cat > requirements.txt <<'EOF'
fastapi
uvicorn
pydantic
numpy
scikit-learn
pytest
# TODO: implement
EOF

# Docker placeholders
cat > docker/Dockerfile <<'EOF'
# TODO: implement
EOF

cat > docker/docker-compose.yml <<'EOF'
# TODO: implement
EOF

# Backend placeholders
cat > backend/app/main.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/routes/__init__.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/routes/game.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/schemas/__init__.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/schemas/game.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/storage/__init__.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/storage/db.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/storage/models.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/core/__init__.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/core/config.py <<'EOF'
# TODO: implement
EOF

cat > backend/app/core/logging.py <<'EOF'
# TODO: implement
EOF

cat > backend/tests/test_api_smoke.py <<'EOF'
# TODO: implement
EOF

# Engine placeholders
cat > engine/poker/__init__.py <<'EOF'
# TODO: implement
EOF

cat > engine/poker/cards.py <<'EOF'
# TODO: implement
EOF

cat > engine/poker/evaluator.py <<'EOF'
# TODO: implement
EOF

cat > engine/poker/state.py <<'EOF'
# TODO: implement
EOF

cat > engine/poker/betting.py <<'EOF'
# TODO: implement
EOF

cat > engine/poker/game.py <<'EOF'
# TODO: implement
EOF

cat > engine/tests/test_evaluator_cases.py <<'EOF'
# TODO: implement
EOF

# Scripts placeholders
cat > scripts/simulate_self_play.py <<'EOF'
# TODO: implement
EOF

cat > scripts/run_monte_carlo.py <<'EOF'
# TODO: implement
EOF

# Documentation
cat > docs/ARCHITECTURE.md <<'EOF'
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
EOF

cat > docs/API_CONTRACT.md <<'EOF'
# API Contract (Planned)

## Base assumptions

- JSON over HTTP.
- Versioning approach (to be implemented): `/api/v1/...`.
- Heads-up Texas Hold'em only in first release.

## Endpoints (planned)

### `POST /game/new`
Create a new heads-up game instance.

**Request (example)**

```json
{
  "stack_size": 1000,
  "small_blind": 5,
  "big_blind": 10,
  "seed": 12345
}
```

**Response (example)**

```json
{
  "game_id": "uuid-string",
  "street": "preflop",
  "pot": 15,
  "hero_position": "button",
  "legal_actions": ["fold", "call", "raise"],
  "state": {}
}
```

### `POST /game/action`
Apply one player action and advance game state.

**Request (example)**

```json
{
  "game_id": "uuid-string",
  "player": "hero",
  "action": "raise",
  "amount": 30
}
```

**Response (example)**

```json
{
  "game_id": "uuid-string",
  "street": "flop",
  "pot": 75,
  "to_act": "villain",
  "legal_actions": ["fold", "call", "raise", "check"],
  "terminal": false,
  "result": null,
  "state": {}
}
```

### `GET /game/state/{game_id}`
Return current public and authorized private state.

**Response (example)**

```json
{
  "game_id": "uuid-string",
  "street": "turn",
  "board": ["Ah", "Kd", "7c", "2s"],
  "pot": 135,
  "stacks": {
    "hero": 910,
    "villain": 955
  },
  "last_action": {
    "player": "villain",
    "action": "call",
    "amount": 30
  },
  "state": {}
}
```

### `GET /health`
Service health/status placeholder.

EOF

cat > docs/STATE_REPRESENTATION.md <<'EOF'
# State Representation (Planned for ML)

## Goals

- Represent heads-up hand state as model-friendly features.
- Preserve enough game context for policy and value estimation.
- Keep deterministic mapping between engine state and feature vector.

## Candidate state fields

- **Game metadata**
  - hand index
  - betting round (`preflop`, `flop`, `turn`, `river`)
  - acting player indicator
- **Stack/pot context**
  - hero stack
  - villain stack
  - pot size
  - effective stack
  - stack-to-pot ratio (SPR)
- **Betting history features**
  - number of raises in current street
  - total aggressor switches
  - last action type
  - last action size (normalized)
- **Card features**
  - hero hole cards (private encoding)
  - board cards (public encoding)
  - blockers / suit coordination indicators
  - board texture flags (paired, monotone, connected)
- **Probability signals (cheat bot baseline)**
  - approximate equity vs random range
  - showdown win probability estimate
  - draw completion probabilities by street
- **Action mask**
  - legal actions binary vector
  - min/max raise bounds (normalized)

## Encoding notes

- Prefer fixed-length vectors with explicit masks for missing street cards.
- Maintain an invertible mapping for debugging and auditability.
- Keep normalization constants in config for reproducibility.
EOF

cat > docs/DECISIONS.md <<'EOF'
# Decision Log

## Scope simplifications (initial)

1. **Heads-up only**
   - Exactly two players (hero vs villain).
2. **No-limit betting abstraction (restricted actions first)**
   - Start with fold/call/check/raise, with simplified raise sizing options.
3. **Single-table, in-memory sessions**
   - Persistence optional; begin with ephemeral state.
4. **Deterministic simulation hooks**
   - Seeded randomness required for reproducible tests.
5. **Cheat-bot as diagnostic baseline**
   - Probability-based policy used for benchmarking and sanity checks.
6. **ML opponent deferred**
   - First milestone focuses on state/action interfaces for later training.

## Open decisions

- Final hand evaluator approach (custom vs external library).
- Persistence strategy (Redis/Postgres/none) for concurrent games.
- API authentication/authorization model.
- Canonical action abstraction for model training.
EOF

echo "Repository scaffold files created."
