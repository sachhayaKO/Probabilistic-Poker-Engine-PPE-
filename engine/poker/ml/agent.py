from __future__ import annotations

"""
Inference agent for the trained PPO poker bot.

BotAgent wraps PPEActorCritic for live play: it loads a checkpoint,
encodes game state, applies action masking, and samples from the policy.
"""

import torch

from engine.poker.game import legal_actions
from engine.poker.ml.model import PPEActorCritic
from engine.poker.ml.state_encoder import GameStateEncoder
from engine.poker.state import GameState


class BotAgent:
    """
    Decision-making agent backed by a trained PPEActorCritic checkpoint.

    Usage::

        agent = BotAgent("scripts/checkpoints/checkpoint_010000.pt")
        action, amount = agent.act(game_state)
        engine.apply_action(game_state, "hero", action, amount)
    """

    def __init__(self, checkpoint_path: str) -> None:
        """
        Load a trained checkpoint and prepare the model for inference.

        Args:
            checkpoint_path: Path to a ``.pt`` file saved by
                ``scripts/train_self_play.py``.  The file must contain a
                ``"model_state_dict"`` key.
        """
        self.model = PPEActorCritic()
        checkpoint: dict[str, object] = torch.load(
            checkpoint_path, map_location="cpu", weights_only=True
        )
        self.model.load_state_dict(checkpoint["model_state_dict"])  # type: ignore[arg-type]
        self.model.eval()
        self.encoder = GameStateEncoder()

    def act(
        self,
        game_state: GameState,
        starting_stack: int = 1000,
        is_dealer: bool = True,
    ) -> tuple[str, int | None]:
        """
        Choose an action for the current game state.

        Encodes the state, runs a forward pass with action masking, and
        samples one action from the resulting distribution.

        Args:
            game_state: Current engine ``GameState``.
            starting_stack: Initial stack for normalization.
            is_dealer: Whether hero occupies the dealer/button seat.

        Returns:
            A ``(action, amount)`` tuple.  *action* is one of
            ``"fold"``, ``"check"``, ``"call"``, ``"raise"``.  *amount*
            is the raise size in chips, or ``None`` for non-raise actions.
        """
        state_vec = self.encoder.encode(
            game_state,
            starting_stack=starting_stack,
            is_dealer=is_dealer,
        )
        x = torch.tensor(state_vec, dtype=torch.float32).unsqueeze(0)

        mask = self._build_action_mask(game_state)
        mask_tensor = torch.tensor([mask], dtype=torch.bool)

        with torch.no_grad():
            probs, _ = self.model(x, action_mask=mask_tensor)

        action_idx = int(torch.multinomial(probs, num_samples=1).item())
        return self._decode_action(action_idx, game_state)

    # ── Private helpers ────────────────────────────────────────────────────

    def _build_action_mask(self, state: GameState) -> list[bool]:
        """
        Build a 5-element boolean mask where ``True`` marks a valid action.

        Raise actions are masked out when the hero stack is too small to
        meet the required bet size.
        """
        eng_legal = set(legal_actions(state))
        hero_stack = state.stacks.get("hero", 0)
        pot = max(state.pot, 1)

        mask: list[bool] = [
            "fold" in eng_legal,
            bool(eng_legal),  # check/call always valid if any action exists
            "raise" in eng_legal and hero_stack >= max(int(0.5 * pot), 1),
            "raise" in eng_legal and hero_stack >= pot,
            "raise" in eng_legal and hero_stack > 0,
        ]
        if not any(mask):
            mask[1] = True
        return mask

    def _decode_action(
        self, action_idx: int, state: GameState
    ) -> tuple[str, int | None]:
        """
        Convert a model action index to an engine-compatible ``(action, amount)`` pair.

        Args:
            action_idx: Integer in ``[0, 4]``.
            state: Current game state used to compute raise amounts.

        Returns:
            ``(action_str, amount_or_none)``
        """
        pot = state.pot
        hero_stack = state.stacks.get("hero", 0)

        if action_idx == 0:
            return "fold", None

        if action_idx == 1:
            # Distinguish check (no bet facing) from call (bet outstanding).
            last_raise = self._last_raise_amount(state)
            return ("call", None) if last_raise > 0 else ("check", None)

        if action_idx == 2:
            amount = max(int(0.5 * pot), 1)
            return "raise", min(amount, hero_stack)

        if action_idx == 3:
            return "raise", min(pot, hero_stack)

        # action_idx == 4: all-in
        return "raise", hero_stack

    def _last_raise_amount(self, state: GameState) -> int:
        """Return the most recent raise amount from betting history, or 0."""
        for record in reversed(state.betting_history):
            if record.get("action") == "raise":
                amount = record.get("amount", 0)
                if isinstance(amount, int):
                    return amount
        return 0
