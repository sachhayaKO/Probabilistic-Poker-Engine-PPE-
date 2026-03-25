from __future__ import annotations

"""
Actor-critic network for the PPO poker bot.

Architecture
------------
Shared trunk  3 fully-connected layers  [256 → 256 → 128]
              ReLU activations, LayerNorm after every layer

Policy head   linear(128, 5)  →  masked softmax
Value head    linear(128, 1)

Action index mapping
--------------------
  0  fold
  1  check / call
  2  raise 0.5× pot
  3  raise 1× pot
  4  all-in
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

from engine.poker.ml.state_encoder import STATE_DIM

NUM_ACTIONS: int = 5

ACTION_NAMES: tuple[str, ...] = (
    "fold",
    "check/call",
    "raise_half_pot",
    "raise_full_pot",
    "all_in",
)


class PPEActorCritic(nn.Module):
    """
    Shared-trunk actor-critic network for PPO training.

    The forward pass returns a masked action-probability distribution and
    a state-value estimate from a single shared feature extractor.
    """

    def __init__(self) -> None:
        """Initialise all layers with PyTorch defaults."""
        super().__init__()

        self.trunk = nn.Sequential(
            nn.Linear(STATE_DIM, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Linear(256, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
        )
        self.policy_head = nn.Linear(128, NUM_ACTIONS)
        self.value_head = nn.Linear(128, 1)

    def forward(
        self,
        x: torch.Tensor,
        action_mask: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Compute action probabilities and state value.

        Args:
            x: Float tensor of shape ``(batch, STATE_DIM)``.
            action_mask: Boolean tensor of shape ``(batch, NUM_ACTIONS)``.
                A ``True`` entry marks a *valid* action.  Invalid actions
                have their logits set to ``-inf`` before the softmax so
                they receive zero probability.

        Returns:
            ``(probs, value)`` where *probs* has shape ``(batch,
            NUM_ACTIONS)`` and *value* has shape ``(batch, 1)``.
        """
        features = self.trunk(x)

        logits = self.policy_head(features)
        if action_mask is not None:
            logits = logits.masked_fill(~action_mask, float("-inf"))
        probs = F.softmax(logits, dim=-1)

        value = self.value_head(features)
        return probs, value
