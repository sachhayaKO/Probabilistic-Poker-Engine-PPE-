from __future__ import annotations

"""Unit tests for engine.poker.ml.state_encoder."""

import pytest

from engine.poker import new_game
from engine.poker.ml.state_encoder import GameStateEncoder, STATE_DIM


class TestGameStateEncoder:
    """Tests for GameStateEncoder.encode."""

    def test_output_length_is_30(self) -> None:
        """Encoded vector must always contain exactly 30 floats."""
        state = new_game(starting_stack=1000, seed=42)
        encoder = GameStateEncoder()
        # Use 1 equity simulation for test speed.
        vec = encoder.encode(state, starting_stack=1000, equity_simulations=1)
        assert len(vec) == STATE_DIM == 30

    def test_all_values_are_floats(self) -> None:
        """Every element in the output vector must be a Python float."""
        state = new_game(starting_stack=1000, seed=7)
        encoder = GameStateEncoder()
        vec = encoder.encode(state, equity_simulations=1)
        for i, v in enumerate(vec):
            assert isinstance(v, float), f"element {i} is {type(v)}, expected float"

    def test_scalar_ranges_preflop(self) -> None:
        """Normalized scalar features should sit in approximately [0, 1]."""
        state = new_game(starting_stack=1000, seed=0)
        encoder = GameStateEncoder()
        vec = encoder.encode(state, starting_stack=1000, equity_simulations=1)
        # Indices 21–29 are scalars; none should be wildly out of range.
        for i in range(21, 30):
            assert -0.1 <= vec[i] <= 1.1, (
                f"scalar at index {i} = {vec[i]} is outside expected range"
            )

    def test_community_card_slots_zero_padded_preflop(self) -> None:
        """Community card slots must be zero when no board cards are dealt."""
        state = new_game(starting_stack=1000, seed=5)
        encoder = GameStateEncoder()
        vec = encoder.encode(state, equity_simulations=1)
        # Indices 6–20 are the 5 community-card triples; all zero at preflop.
        for i in range(6, 21):
            assert vec[i] == 0.0, f"community slot {i} should be 0.0 at preflop"

    def test_hole_card_presence_flag_is_one(self) -> None:
        """The presence flag (index 2 and 5) for hole cards must be 1.0."""
        state = new_game(starting_stack=1000, seed=3)
        encoder = GameStateEncoder()
        vec = encoder.encode(state, equity_simulations=1)
        assert vec[2] == 1.0, "hole card 1 presence flag must be 1.0"
        assert vec[5] == 1.0, "hole card 2 presence flag must be 1.0"

    def test_equity_in_unit_interval(self) -> None:
        """Monte Carlo equity estimate must lie in [0.0, 1.0]."""
        state = new_game(starting_stack=1000, seed=99)
        encoder = GameStateEncoder()
        vec = encoder.encode(state, equity_simulations=10)
        equity = vec[28]
        assert 0.0 <= equity <= 1.0, f"equity {equity} outside [0, 1]"
