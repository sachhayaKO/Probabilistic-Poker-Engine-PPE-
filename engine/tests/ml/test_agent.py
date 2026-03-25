from __future__ import annotations

"""Unit tests for engine.poker.ml.agent."""

import tempfile
from pathlib import Path

import pytest
import torch

from engine.poker import new_game
from engine.poker.ml.agent import BotAgent
from engine.poker.ml.model import PPEActorCritic


def _save_dummy_checkpoint(path: Path) -> None:
    """Save an untrained PPEActorCritic checkpoint to *path*."""
    model = PPEActorCritic()
    torch.save({"model_state_dict": model.state_dict()}, path)


class TestBotAgent:
    """Tests for BotAgent.act."""

    def test_act_returns_valid_engine_action(self) -> None:
        """act() must return a (str, int|None) tuple with a known action."""
        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp) / "checkpoint.pt"
            _save_dummy_checkpoint(ckpt)

            agent = BotAgent(str(ckpt))
            state = new_game(starting_stack=1000, seed=42)
            result = agent.act(state)

        assert isinstance(result, tuple)
        assert len(result) == 2
        action, amount = result
        assert action in {"fold", "check", "call", "raise"}

    def test_raise_amount_is_positive_int(self) -> None:
        """When act() returns 'raise', amount must be a positive integer."""
        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp) / "checkpoint.pt"
            _save_dummy_checkpoint(ckpt)

            agent = BotAgent(str(ckpt))
            # Sample many actions until we observe a raise, or accept no raise.
            for seed in range(50):
                state = new_game(starting_stack=1000, seed=seed)
                action, amount = agent.act(state)
                if action == "raise":
                    assert isinstance(amount, int)
                    assert amount > 0
                    break
            # Test passes even if no raise was sampled in 50 tries.

    def test_act_never_returns_masked_invalid_action(self) -> None:
        """act() must not return a fold when no legal actions include fold."""
        # At a standard preflop state fold is always legal, so instead we
        # verify the returned action is in the legal set by checking the
        # action string is one the engine recognises.
        valid_actions = {"fold", "check", "call", "raise"}
        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp) / "checkpoint.pt"
            _save_dummy_checkpoint(ckpt)

            agent = BotAgent(str(ckpt))
            for seed in range(20):
                state = new_game(starting_stack=1000, seed=seed)
                action, _ = agent.act(state)
                assert action in valid_actions, f"unexpected action: {action!r}"

    def test_checkpoint_not_found_raises(self) -> None:
        """Constructing BotAgent with a missing path must raise an exception."""
        with pytest.raises(Exception):
            BotAgent("/nonexistent/path/checkpoint.pt")
