# Decision Log

## Scope simplifications (initial)

1. Heads-up only
   - Exactly two players (`hero`, `villain`).
2. No-limit betting abstraction (restricted actions first)
   - Start with `fold`, `call`, `check`, `raise`.
3. Single-table, in-memory sessions
   - Persistence deferred beyond Day 1.
4. Deterministic simulation hooks
   - Seeded randomness required for reproducible tests.
5. Cheat-bot as diagnostic baseline
   - Probability-based policy used for benchmarking and sanity checks.
6. ML opponent deferred
   - First milestone focuses on state/action interfaces.

## Day 1 contract decisions

1. Card string format is rank+suit using 2-char tokens, e.g. `"Ah"`, `"Kd"`, `"7c"`, `"2s"`.
2. Street enum is fixed to: `preflop`, `flop`, `turn`, `river`, `showdown`.
3. Player ids are fixed to: `hero`, `villain`.
4. Seed policy: `seed` is optional (`int | null`) and when present controls deterministic deck shuffle/order.
5. Action enum (v1): `fold`, `check`, `call`, `raise` (`amount` only required for `raise`).

## Resolved decisions

6. Hand evaluator approach
   - Custom pure-Python implementation using `itertools.combinations` in `engine/poker/evaluator.py`.
   - Chosen to avoid external library dependencies and keep the engine self-contained.
7. Persistence strategy
   - In-memory dict (`game_store` in `backend/app/storage/db.py`).
   - PostgreSQL remains a future option but was not required for the current milestone.
8. ML opponent
   - PPO actor-critic agent implemented in `engine/poker/ml/`.
   - Trained via self-play using `scripts/train_self_play.py`.
   - Loaded at runtime when `difficulty=ppo`; falls back to random if no checkpoint exists.
9. State encoding
   - 30-dimensional fixed-length float vector defined in `engine/poker/ml/state_encoder.py`.
   - Captures stack sizes, pot, street, hole cards, board cards, and betting history.

## Open decisions

- API authentication/authorization model.
- Canonical action abstraction for model training.
