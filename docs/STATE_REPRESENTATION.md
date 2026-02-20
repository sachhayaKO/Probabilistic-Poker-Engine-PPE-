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
