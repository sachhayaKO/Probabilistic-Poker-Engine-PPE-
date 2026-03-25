from __future__ import annotations

"""Unit tests for engine.poker.ml.model."""

import torch
import pytest

from engine.poker.ml.model import PPEActorCritic, NUM_ACTIONS, STATE_DIM


class TestPPEActorCritic:
    """Tests for PPEActorCritic forward pass and masking."""

    def _make_input(self, batch: int = 1) -> torch.Tensor:
        """Return a random state tensor of shape (batch, STATE_DIM)."""
        return torch.rand(batch, STATE_DIM)

    def test_output_shapes(self) -> None:
        """Forward pass must return (batch, 5) probs and (batch, 1) value."""
        model = PPEActorCritic()
        x = self._make_input(batch=4)
        probs, value = model(x)
        assert probs.shape == (4, NUM_ACTIONS)
        assert value.shape == (4, 1)

    def test_probabilities_sum_to_one(self) -> None:
        """Action probabilities must sum to 1.0 for every item in the batch."""
        model = PPEActorCritic()
        x = self._make_input(batch=8)
        probs, _ = model(x)
        sums = probs.sum(dim=-1)
        assert torch.allclose(sums, torch.ones(8), atol=1e-5)

    def test_masked_action_receives_zero_probability(self) -> None:
        """An action masked to False must receive exactly zero probability."""
        model = PPEActorCritic()
        x = self._make_input(batch=1)
        # Mask out action 0 (fold).
        mask = torch.ones(1, NUM_ACTIONS, dtype=torch.bool)
        mask[0, 0] = False
        probs, _ = model(x, action_mask=mask)
        assert probs[0, 0].item() == pytest.approx(0.0, abs=1e-6)

    def test_all_masked_except_one(self) -> None:
        """When only one action is valid its probability must be 1.0."""
        model = PPEActorCritic()
        x = self._make_input(batch=1)
        mask = torch.zeros(1, NUM_ACTIONS, dtype=torch.bool)
        mask[0, 2] = True  # only raise_half_pot is valid
        probs, _ = model(x, action_mask=mask)
        assert probs[0, 2].item() == pytest.approx(1.0, abs=1e-5)

    def test_no_mask_produces_all_nonzero_probs(self) -> None:
        """Without a mask all five actions should have positive probability."""
        model = PPEActorCritic()
        x = self._make_input(batch=1)
        probs, _ = model(x)
        assert (probs > 0).all(), "expected all probabilities > 0 when no mask"

    def test_value_head_is_scalar_per_sample(self) -> None:
        """Value output must be a single float per sample."""
        model = PPEActorCritic()
        x = self._make_input(batch=3)
        _, value = model(x)
        assert value.shape == (3, 1)
        # Values can be arbitrary reals, just check they're finite.
        assert torch.isfinite(value).all()
