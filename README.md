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
