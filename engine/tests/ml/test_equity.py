from __future__ import annotations

"""Unit tests for engine.poker.ml.equity."""

import pytest

from engine.poker.cards import Card
from engine.poker.ml.equity import run_equity_estimate


class TestRunEquityEstimate:
    """Tests for run_equity_estimate."""

    def test_returns_float_in_unit_interval(self) -> None:
        """Equity must be a float in [0.0, 1.0]."""
        hole = [Card("A", "s"), Card("K", "s")]
        equity = run_equity_estimate(hole, [], n_simulations=20, seed=0)
        assert isinstance(equity, float)
        assert 0.0 <= equity <= 1.0

    def test_nut_flush_draw_higher_than_random(self) -> None:
        """AA preflop should win substantially more than 50% against random."""
        hole = [Card("A", "s"), Card("A", "h")]
        equity = run_equity_estimate(hole, [], n_simulations=200, seed=42)
        # AA preflop equity ≈ 85%; we use a conservative threshold.
        assert equity > 0.65, f"AA equity {equity:.3f} unexpectedly low"

    def test_deterministic_with_seed(self) -> None:
        """Same seed must produce the same equity estimate."""
        hole = [Card("T", "d"), Card("9", "d")]
        board = [Card("J", "d"), Card("Q", "d"), Card("K", "c")]
        eq1 = run_equity_estimate(hole, board, n_simulations=50, seed=7)
        eq2 = run_equity_estimate(hole, board, n_simulations=50, seed=7)
        assert eq1 == eq2

    def test_raises_on_wrong_hole_card_count(self) -> None:
        """ValueError raised when hole_cards does not contain exactly 2 cards."""
        with pytest.raises(ValueError, match="hole_cards must have 2 cards"):
            run_equity_estimate([Card("A", "s")], [], n_simulations=10)

    def test_raises_on_too_many_community_cards(self) -> None:
        """ValueError raised when more than 5 community cards are supplied."""
        hole = [Card("A", "s"), Card("K", "s")]
        board = [
            Card("2", "c"), Card("3", "d"), Card("4", "h"),
            Card("5", "s"), Card("6", "c"), Card("7", "d"),
        ]
        with pytest.raises(ValueError, match="community_cards must have"):
            run_equity_estimate(hole, board, n_simulations=10)

    def test_equity_with_full_board(self) -> None:
        """Equity with all 5 board cards should still return a valid float."""
        hole = [Card("A", "s"), Card("A", "d")]
        board = [
            Card("K", "c"), Card("K", "d"), Card("K", "h"),
            Card("2", "s"), Card("3", "c"),
        ]
        equity = run_equity_estimate(hole, board, n_simulations=20, seed=1)
        # AAKK board + AA in hand = aces full of kings, very strong
        assert equity > 0.5
