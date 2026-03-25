from __future__ import annotations

"""
Fixed-length game-state encoder for the PPO poker bot.

Encodes a GameState object as a 30-dimensional float vector consumed by
PPEActorCritic.  The encoding layout is:

  Indices  0– 2  hole card 1          [rank/12, suit/3, 1.0]
  Indices  3– 5  hole card 2          [rank/12, suit/3, 1.0]
  Indices  6– 8  community card 1     [rank/12, suit/3, present]
  Indices  9–11  community card 2     [rank/12, suit/3, present]
  Indices 12–14  community card 3     [rank/12, suit/3, present]
  Indices 15–17  community card 4     [rank/12, suit/3, present]
  Indices 18–20  community card 5     [rank/12, suit/3, present]
  Index   21     street               (0=preflop … 3=river) / 3
  Index   22     pot / starting_stack
  Index   23     hero stack / starting_stack
  Index   24     villain stack / starting_stack
  Index   25     position             (0=dealer/button, 1=big blind)
  Index   26     bet to call / max(pot, 1)
  Index   27     raises this street / 4   (capped at 4)
  Index   28     Monte Carlo equity estimate
  Index   29     pot odds             call / (pot + call)
"""

from engine.poker.cards import RANKS, SUITS, Card
from engine.poker.state import GameState

STATE_DIM: int = 30

_STREET_INDEX: dict[str, int] = {
    "preflop": 0,
    "flop": 1,
    "turn": 2,
    "river": 3,
    "showdown": 3,
}


class GameStateEncoder:
    """Converts a GameState into a fixed-length 30-float feature vector."""

    def encode(
        self,
        state: GameState,
        starting_stack: int = 1000,
        is_dealer: bool = True,
        equity_simulations: int = 500,
    ) -> list[float]:
        """
        Encode *state* as a 30-dimensional float vector.

        Args:
            state: Current engine game state.
            starting_stack: Initial stack size used for normalization.
            is_dealer: True if hero holds the dealer/button position.
            equity_simulations: Number of Monte Carlo rollouts for equity
                estimation.  Reduce during training for speed.

        Returns:
            A list of exactly 30 floats, all in approximately [0, 1].
        """
        # Import here to avoid a circular import at module load time.
        from engine.poker.ml.equity import run_equity_estimate

        vec: list[float] = []

        # ── Hole cards (2 × 3 = 6 floats) ────────────────────────────────
        for card in state.hands["hero"]:
            vec.extend(self._encode_card(card, present=True))

        # ── Community cards (5 × 3 = 15 floats, zero-padded) ─────────────
        for i in range(5):
            if i < len(state.board):
                vec.extend(self._encode_card(state.board[i], present=True))
            else:
                vec.extend([0.0, 0.0, 0.0])

        # ── Scalar features (9 floats) ────────────────────────────────────
        vec.append(_STREET_INDEX.get(state.street, 0) / 3.0)

        safe_stack = max(starting_stack, 1)
        vec.append(state.pot / safe_stack)
        vec.append(state.stacks.get("hero", 0) / safe_stack)
        vec.append(state.stacks.get("villain", 0) / safe_stack)

        vec.append(0.0 if is_dealer else 1.0)

        bet_to_call = self._compute_bet_to_call(state)
        safe_pot = max(state.pot, 1)
        vec.append(bet_to_call / safe_pot)

        raises = sum(1 for a in state.betting_history if a.get("action") == "raise")
        vec.append(min(raises, 4) / 4.0)

        equity = run_equity_estimate(
            state.hands["hero"], state.board, n_simulations=equity_simulations
        )
        vec.append(equity)

        pot_odds = bet_to_call / max(bet_to_call + state.pot, 1.0)
        vec.append(pot_odds)

        assert len(vec) == STATE_DIM, f"expected {STATE_DIM} floats, got {len(vec)}"
        return vec

    # ── Private helpers ────────────────────────────────────────────────────

    def _encode_card(self, card: Card, present: bool) -> list[float]:
        """Return [rank/12, suit/3, present_flag] for a single card."""
        return [
            RANKS.index(card.rank) / 12.0,
            SUITS.index(card.suit) / 3.0,
            1.0 if present else 0.0,
        ]

    def _compute_bet_to_call(self, state: GameState) -> float:
        """
        Approximate the current bet to call from the betting history.

        Scans backwards for the most recent raise amount, which serves as
        a proxy for the outstanding bet in the placeholder betting engine.
        """
        for record in reversed(state.betting_history):
            if record.get("action") == "raise":
                amount = record.get("amount", 0)
                if isinstance(amount, (int, float)):
                    return float(amount)
        return 0.0
