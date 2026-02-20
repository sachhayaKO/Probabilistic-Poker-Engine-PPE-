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
